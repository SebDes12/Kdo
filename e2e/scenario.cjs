// Scénario de bout en bout : base vide + app lancée sur BASE_URL.
// Usage : DATABASE_URL=… npm run build && npm start & node e2e/scenario.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOTS_DIR ?? __dirname + "/shots";
require("fs").mkdirSync(OUT, { recursive: true });
const date = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
let n = 0;
const shot = (p, name) => p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });
const ok = (c, m) => { if (!c) throw new Error("ÉCHEC: " + m); console.log("ok -", m); };

(async () => {
  const browser = await chromium.launch();
  const ctx = () => browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 });

  // 1. Premier compte
  const papaCtx = await ctx(); const papa = await papaCtx.newPage();
  papa.on("pageerror", (e) => console.log("PAGEERROR papa", e.message));
  await papa.goto(BASE);
  ok(papa.url().includes("/bienvenue"), "base vide → bienvenue");
  await shot(papa, "bienvenue");
  await papa.fill("#name", "Seb"); await papa.fill("#email", "papa@test.fr"); await papa.fill("#password", "motdepasse1");
  await papa.click("text=Créer mon compte");
  await papa.waitForURL(/famille/);
  // 2. Groupe + invitation
  await papa.fill('input[name="name"][placeholder="Nom du groupe"]', "Toute la famille");
  await papa.click("text=+ Créer");
  await papa.waitForURL(/groupes/);
  await papa.goto(BASE + "/famille");
  await papa.selectOption('select[name="group"]', { index: 1 });
  await papa.click("text=Créer un lien");
  await papa.waitForSelector('input[readonly]');
  const invite = await papa.inputValue('input[readonly]');
  ok(invite.includes("/invitation/"), "lien d'invitation créé");
  // Visibilité de ma liste
  await papa.locator("#visibilite form").first().locator("button").click();
  await papa.waitForLoadState("networkidle");
  // 3. Enfant
  await papa.fill('input[placeholder="Prénom de l\'enfant"]', "Léo");
  await papa.click("text=+ Ajouter un enfant");
  await papa.waitForURL(/enfants/);
  await papa.fill("#login", "leo"); await papa.fill("#password", "secret1");
  await papa.click("button:has-text('Créer')");
  await papa.waitForURL(/ok=/);
  await papa.locator("#visibilite form").first().locator("button").click();
  await papa.waitForLoadState("networkidle");
  await shot(papa, "enfant");
  await papa.goto(BASE + "/famille"); await shot(papa, "famille");

  // 4. Maman accepte l'invitation
  const mamanCtx = await ctx(); const maman = await mamanCtx.newPage();
  maman.on("pageerror", (e) => console.log("PAGEERROR maman", e.message));
  await maman.goto(invite);
  await shot(maman, "invitation");
  await maman.fill("#name", "Julie"); await maman.fill("#email", "maman@test.fr"); await maman.fill("#password", "motdepasse2");
  await maman.click("text=Créer mon compte");
  await maman.waitForURL(/bienvenue=1/);
  await maman.goto(BASE + "/famille");
  await maman.locator("#visibilite form").first().locator("button").click();
  await maman.waitForLoadState("networkidle");

  // 5. Événement
  await papa.goto(BASE + "/evenements/nouveau");
  await papa.fill("#name", "Noël 2026"); await papa.fill("#date", date);
  for (const cb of await papa.locator('input[name="beneficiaries"]').all()) await cb.check();
  await shot(papa, "nouvel-evenement");
  await papa.click("text=Créer l'événement");
  await papa.waitForURL(/evenements\/[0-9a-f-]{36}$/);
  const eventUrl = papa.url();

  // 6. Papa ajoute une idée
  await papa.goto(BASE + "/");
  await papa.locator("a:visible", { hasText: "Ma liste" }).first().click();
  await papa.locator('a:visible:text-is("+ Ajouter")').first().click();
  await papa.fill("#title", "Perceuse sans fil");
  await papa.fill('input[name="links"]', "www.example.com/perceuse");
  await papa.fill("#price", "89,90");
  await papa.selectOption("#priority", "2");
  await shot(papa, "nouvelle-idee");
  await papa.click("text=Ajouter l'idée");
  await papa.waitForURL(/listes/);
  await papa.locator('a:visible:text-is("+ Ajouter")').first().click();
  await papa.fill("#title", "Casque audio"); await papa.click("text=Ajouter l'idée"); await papa.waitForURL(/listes/);
  await shot(papa, "ma-liste");

  // 7. Maman prend la perceuse et suggère un livre secret
  await maman.goto(eventUrl);
  await maman.locator("article", { hasText: "Perceuse" }).locator("text=Je le prends").click();
  await maman.waitForLoadState("networkidle");
  await maman.locator("article", { hasText: "Casque" }).locator("summary").click();
  await maman.locator("article", { hasText: "Casque" }).locator('input[type=number]').fill("40");
  await maman.locator("article", { hasText: "Casque" }).locator("text=OK").click();
  await maman.waitForLoadState("networkidle");
  await maman.locator("section", { hasText: "Pour Seb" }).locator(`a:has-text("+ Suggérer")`).click();
  await maman.fill("#title", "Livre surprise");
  await shot(maman, "suggestion");
  await maman.click("text=Suggérer l'idée");
  await maman.waitForURL(/evenements/);
  await maman.goto(eventUrl);
  await shot(maman, "evenement-maman");
  ok(await maman.locator("text=Livre surprise").count() === 1, "maman voit sa suggestion");

  // 8. Papa ne voit rien
  await papa.goto(eventUrl);
  await shot(papa, "evenement-papa");
  ok(await papa.locator("text=Livre surprise").count() === 0, "papa ne voit pas la suggestion secrète");
  ok(await papa.locator("text=Tu offres").count() === 0 && await papa.locator("text=Déjà choisi").count() === 0, "papa ne voit aucun état choisi");
  ok(await papa.locator("text=Julie : 40").count() === 0, "papa ne voit pas la participation");

  // 9. Léo
  const leoCtx = await ctx(); const leo = await leoCtx.newPage();
  await leo.goto(BASE + "/connexion");
  await shot(leo, "connexion");
  await leo.fill("#identifiant", "leo"); await leo.fill("#password", "secret1");
  await leo.click("text=Se connecter");
  await leo.waitForURL(BASE + "/");
  await shot(leo, "accueil-leo");
  await leo.locator("a:visible", { hasText: "Ma liste" }).first().click();
  await leo.locator('a:visible:text-is("+ Ajouter")').first().click();
  await leo.fill("#title", "Doudou licorne"); await leo.click("text=Ajouter l'idée"); await leo.waitForURL(/listes/);

  await maman.goto(eventUrl);
  await maman.locator("article", { hasText: "Doudou" }).locator("text=Je le prends").click();
  await maman.waitForLoadState("networkidle");
  await leo.goto(eventUrl);
  await shot(leo, "evenement-leo");
  ok(await leo.locator("text=Déjà choisi").count() === 0 && await leo.locator("text=Tu offres").count() === 0, "Léo ne voit pas que le doudou est pris");

  // 10. Papa (parent) voit le choix sur la liste de Léo ; mes cadeaux de maman
  await papa.goto(eventUrl);
  ok(await papa.locator("article", { hasText: "Doudou" }).locator("text=Déjà choisi").count() === 1, "papa voit que le doudou est pris");
  await maman.goto(BASE + "/mes-cadeaux");
  await shot(maman, "mes-cadeaux");
  ok(await maman.locator("text=Perceuse sans fil").count() === 1, "mes cadeaux liste la perceuse");
  await maman.goto(BASE + "/");
  await shot(maman, "accueil-maman");

  // 11. Papa crée un lien « mot de passe » pour Julie, qui le change
  await papa.goto(BASE + "/famille#membres");
  papa.once("dialog", (d) => d.accept());
  await papa.locator("li", { hasText: "Julie" }).locator("text=Mot de passe").click();
  await papa.waitForSelector("#membres input[readonly]");
  const resetLink = await papa.inputValue("#membres input[readonly]");
  ok(resetLink.includes("/reinitialiser/"), "lien de réinitialisation créé");
  const julie2Ctx = await ctx(); const julie2 = await julie2Ctx.newPage();
  await julie2.goto(resetLink);
  await julie2.fill("#password", "nouveaumdp1");
  await julie2.click("text=Enregistrer");
  await julie2.waitForURL(/ok=/);
  ok(!julie2.url().includes("connexion"), "Julie est connectée après réinitialisation");
  await maman.goto(BASE + "/");
  ok(maman.url().includes("/connexion"), "l'ancienne session de Julie est fermée");
  await maman.fill("#identifiant", "maman@test.fr"); await maman.fill("#password", "nouveaumdp1");
  await maman.click("text=Se connecter");
  await maman.waitForURL(BASE + "/");
  ok(true, "Julie se reconnecte avec le nouveau mot de passe");

  await browser.close();
  console.log("E2E OK");
})().catch((e) => { console.error(e); process.exit(1); });
