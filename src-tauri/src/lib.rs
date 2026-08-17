use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager, Wry,
};
use tauri_plugin_autostart::ManagerExt;

/// Skins the window can render, in the order the tray menu lists them.
const SKINS: [(&str, &str); 4] = [
    ("planet", "Planet + moon"),
    ("cat", "Cat loaf"),
    ("ghost", "Ghost"),
    ("bloub", "Bloub (ink)"),
];
const DEFAULT_SKIN: &str = "planet";
const SUPPORT_URL: &str = "https://buymeacoffee.com/hectormendoza";

/// Tray check items, kept so the ticks can be updated when the skin changes from
/// anywhere — the tray itself, or a right-click on the window.
struct SkinMenu(Mutex<Vec<(String, CheckMenuItem<Wry>)>>);

/// Raw contents of ~/.claude-orb/status.json plus a little metadata the UI needs.
#[derive(Serialize)]
pub struct StatusPayload {
    /// Parsed JSON object from the status file, or null if missing/unreadable/invalid.
    status: Option<serde_json::Value>,
    /// Wall-clock seconds since the file was last modified. Used as a fallback when the
    /// status file has no usable `timestamp` field.
    age_secs: Option<u64>,
    /// Absolute path we looked at, surfaced for debugging in the devtools console.
    path: String,
}

/// HOME on unix, USERPROFILE on Windows — the status file lives in the same place the
/// hook script writes it, so this has to agree with the shell script on every platform.
fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_default()
}

fn orb_dir() -> PathBuf {
    home_dir().join(".claude-orb")
}

fn status_path() -> PathBuf {
    orb_dir().join("status.json")
}

fn config_path() -> PathBuf {
    orb_dir().join("config.json")
}

fn read_config() -> serde_json::Map<String, serde_json::Value> {
    std::fs::read_to_string(config_path())
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

/// Merge a single key, so writing one setting can't clobber the others.
fn write_config_key(key: &str, value: serde_json::Value) {
    if std::fs::create_dir_all(orb_dir()).is_err() {
        return;
    }
    let mut cfg = read_config();
    cfg.insert(key.to_string(), value);
    if let Ok(body) = serde_json::to_string(&cfg) {
        let _ = std::fs::write(config_path(), format!("{body}\n"));
    }
}

fn read_skin() -> String {
    read_config()
        .get("skin")
        .and_then(|s| s.as_str())
        .map(str::to_owned)
        .filter(|s| SKINS.iter().any(|(id, _)| id == s))
        .unwrap_or_else(|| DEFAULT_SKIN.to_string())
}

fn write_skin(name: &str) {
    write_config_key("skin", serde_json::Value::String(name.to_string()));
}

/// Full cwd of the most recent session, as recorded by the hook script.
fn status_cwd() -> Option<String> {
    let raw = std::fs::read_to_string(status_path()).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("cwd")
        .and_then(|c| c.as_str())
        .map(str::to_owned)
        .filter(|c| !c.is_empty())
}

/// Opens the most recent session's project directory in an editor.
///
/// Preference order: an `editor` set in config.json, then Cursor, then VS Code, then
/// whatever the OS does with a folder (Finder / Explorer / xdg-open). Paths are passed
/// as arguments to a known binary — never through a shell — so a project path with
/// spaces or shell metacharacters can't be misinterpreted.
// The per-OS blocks below each end in an explicit `return`. Clippy flags the last one as
// needless because on any single target the others are compiled away — but dropping it
// breaks the other targets, so the lint is wrong here rather than the code.
#[allow(clippy::needless_return)]
#[tauri::command]
fn open_project() -> Result<String, String> {
    let cwd = status_cwd().ok_or("no project recorded yet")?;
    let path = PathBuf::from(&cwd);
    if !path.is_dir() {
        return Err(format!("not a directory: {cwd}"));
    }

    let preferred = read_config()
        .get("editor")
        .and_then(|e| e.as_str())
        .map(str::to_owned);

    #[cfg(target_os = "macos")]
    {
        let candidates: Vec<String> = match preferred {
            Some(name) => vec![name],
            None => vec!["Cursor".to_string(), "Visual Studio Code".to_string()],
        };
        for app in &candidates {
            if !PathBuf::from(format!("/Applications/{app}.app")).exists() {
                continue;
            }
            if std::process::Command::new("open")
                .arg("-a")
                .arg(app)
                .arg(&path)
                .spawn()
                .is_ok()
            {
                return Ok(app.clone());
            }
        }
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok("Finder".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        for bin in preferred
            .into_iter()
            .chain(["cursor".into(), "code".into()])
        {
            if std::process::Command::new(&bin).arg(&path).spawn().is_ok() {
                return Ok(bin);
            }
        }
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok("Explorer".to_string());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for bin in preferred
            .into_iter()
            .chain(["cursor".into(), "code".into()])
        {
            if std::process::Command::new(&bin).arg(&path).spawn().is_ok() {
                return Ok(bin);
            }
        }
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok("xdg-open".to_string());
    }
}

#[tauri::command]
fn read_status() -> StatusPayload {
    let path = status_path();
    let path_str = path.to_string_lossy().to_string();

    let age_secs = std::fs::metadata(&path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.elapsed().ok())
        .map(|d| d.as_secs());

    let status = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    StatusPayload {
        status,
        age_secs,
        path: path_str,
    }
}

#[tauri::command]
fn get_skin() -> String {
    read_skin()
}

/// Persists the skin, syncs the tray ticks, and tells the window to switch.
#[tauri::command]
fn set_skin(app: tauri::AppHandle, name: String) {
    if !SKINS.iter().any(|(id, _)| *id == name) {
        return;
    }
    write_skin(&name);

    if let Some(menu) = app.try_state::<SkinMenu>() {
        if let Ok(items) = menu.0.lock() {
            for (id, item) in items.iter() {
                let _ = item.set_checked(*id == name);
            }
        }
    }

    let _ = app.emit("skin-changed", name);
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

/// Opens the Buy Me a Coffee page in the default browser.
///
/// Same approach as `open_project`: spawn a known binary with the URL as an argument,
/// never a shell string, so the constant URL can't pick up metacharacters from elsewhere.
fn open_support_url() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(SUPPORT_URL).spawn();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", SUPPORT_URL])
            .spawn();
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(SUPPORT_URL)
            .spawn();
    }
}

fn set_autostart(app: &tauri::AppHandle, enabled: bool) -> bool {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(err) = result {
        eprintln!("autostart toggle failed: {err}");
    }
    manager.is_enabled().unwrap_or(false)
}

/// Show or hide the orb window and keep the tray item's label in sync.
///
/// The item reads "Hide orb" while the window is up, and "Show orb" while it's
/// hidden, so the tray is always the way back without quitting.
fn set_orb_visible(app: &tauri::AppHandle, item: &MenuItem<Wry>, visible: bool) {
    let Some(w) = app.get_webview_window("orb") else {
        return;
    };
    if visible {
        let _ = w.show();
        let _ = w.set_always_on_top(true);
        let _ = item.set_text("Hide orb");
    } else {
        let _ = w.hide();
        let _ = item.set_text("Show orb");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            read_status,
            get_skin,
            set_skin,
            open_project,
            quit
        ])
        .setup(|app| {
            // Agent app: tray only, no Dock icon and no menu bar.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let current = read_skin();

            // The window has no decorations and is hidden from the dock/taskbar, so the
            // tray is the only reliable way to quit, hide, re-find, or restyle the orb.
            let mut skin_items = Vec::new();
            for (id, label) in SKINS {
                skin_items.push((
                    id.to_string(),
                    CheckMenuItem::with_id(
                        app,
                        format!("skin:{id}"),
                        label,
                        true,
                        id == current,
                        None::<&str>,
                    )?,
                ));
            }
            let skin_refs: Vec<&dyn tauri::menu::IsMenuItem<Wry>> = skin_items
                .iter()
                .map(|(_, item)| item as &dyn tauri::menu::IsMenuItem<Wry>)
                .collect();
            let skin_menu = Submenu::with_items(app, "Look", true, &skin_refs)?;

            let launch_on = app.autolaunch().is_enabled().unwrap_or(false);
            let login_item = CheckMenuItem::with_id(
                app,
                "login",
                "Open at Login",
                true,
                launch_on,
                None::<&str>,
            )?;

            let show = MenuItem::with_id(app, "toggle-visible", "Hide orb", true, None::<&str>)?;
            let coffee = MenuItem::with_id(app, "coffee", "Buy me a coffee", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Orbit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let sep_support = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &skin_menu,
                    &sep,
                    &login_item,
                    &show,
                    &sep_support,
                    &coffee,
                    &quit_item,
                ],
            )?;

            app.manage(SkinMenu(Mutex::new(skin_items)));

            let login_toggle = login_item.clone();
            let show_toggle = show.clone();
            let mut tray = TrayIconBuilder::new()
                .icon_as_template(true)
                .tooltip("Orbit")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| {
                    let id = event.id.as_ref();
                    if let Some(name) = id.strip_prefix("skin:") {
                        set_skin(app.clone(), name.to_string());
                        return;
                    }
                    match id {
                        "login" => {
                            // Derive intent from the real login-item state rather than the
                            // checkbox: a native check item toggles itself on click, so
                            // reading it here would give the opposite of what was wanted.
                            let currently = app.autolaunch().is_enabled().unwrap_or(false);
                            let actual = set_autostart(app, !currently);
                            // Sync the tick to what actually happened, not what was asked.
                            let _ = login_toggle.set_checked(actual);
                        }
                        "quit" => app.exit(0),
                        "coffee" => open_support_url(),
                        "toggle-visible" => {
                            if let Some(w) = app.get_webview_window("orb") {
                                let visible = w.is_visible().unwrap_or(true);
                                set_orb_visible(app, &show_toggle, !visible);
                            }
                        }
                        _ => {}
                    }
                });

            // The menu bar gets its own asset: eyes only, on transparency. The app icon
            // is a filled navy plate, which template mode would flatten into a solid
            // black blob. Falls back to the window icon if that asset ever fails to load.
            match tauri::image::Image::from_bytes(include_bytes!("../icons/tray@2x.png")) {
                Ok(icon) => tray = tray.icon(icon),
                Err(err) => {
                    eprintln!("tray icon failed to load: {err}");
                    if let Some(icon) = app.default_window_icon().cloned() {
                        tray = tray.icon(icon);
                    }
                }
            }
            tray.build(app)?;

            if let Some(w) = app.get_webview_window("orb") {
                // Belt and braces: keep the orb above full-screen-ish app windows too.
                let _ = w.set_always_on_top(true);
                #[cfg(target_os = "macos")]
                let _ = w.set_visible_on_all_workspaces(true);

                // Park it in the top-right of the current monitor. Computed at runtime so
                // it lands correctly on any display size, rather than hardcoded coordinates.
                if let (Ok(Some(monitor)), Ok(size)) = (w.current_monitor(), w.outer_size()) {
                    let area = monitor.size();
                    let origin = monitor.position();
                    let scale = monitor.scale_factor();
                    let margin = (16.0 * scale).round() as i32;
                    // Clear the menu bar on macOS; a plain margin elsewhere.
                    let top = if cfg!(target_os = "macos") {
                        (32.0 * scale).round() as i32
                    } else {
                        margin
                    };
                    let x = origin.x + area.width as i32 - size.width as i32 - margin;
                    let y = origin.y + top;
                    let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Orbit");
}
