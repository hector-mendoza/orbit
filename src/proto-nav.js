// Shared footer nav so the concepts are easy to flip between.
const PROTOS = [
  ["proto-planet.html", "planet + moon"],
  ["proto-drone.html", "drone"],
  ["proto-cat.html", "cat loaf"],
  ["proto-ghost.html", "ghost"],
  ["proto-dino.html", "dino"],
  ["proto-bloub.html", "bloub"],
  ["proto-growth.html", "growth"],
];
const here = location.pathname.split("/").pop();
const nav = document.getElementById("nav");
for (const [href, name] of PROTOS) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = name;
  if (href === here) a.className = "on";
  nav.append(a);
}
