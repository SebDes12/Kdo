// Scénario de bout en bout : base vide + app lancée sur BASE_URL.
// Usage : DATABASE_URL=… npm run build && npm start & node e2e/scenario.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOTS_DIR ?? __dirname + "/shots";
require("fs").mkdirSync(OUT, { recursive: true });
const date = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const dateFin = new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10);
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
  await papa.fill('input[name="name"][placeholder="Nom du groupe"]', "Côté papa");
  await papa.click("text=+ Créer");
  await papa.waitForURL(/groupes/);
  await papa.goto(BASE + "/famille");
  for (const g of ["Toute la famille", "Côté papa"]) await papa.locator("label", { hasText: g }).locator('input[name="groups"]').check();
  await papa.click("text=Créer un lien d'invitation");
  await papa.waitForSelector('input[readonly]');
  const invite = await papa.inputValue('input[readonly]');
  ok(invite.includes("/invitation/"), "lien d'invitation créé");
  // 3. Enfant
  await papa.fill('input[placeholder="Prénom de l\'enfant"]', "Léo");
  await papa.click("text=+ Ajouter un enfant");
  await papa.waitForURL(/enfants/);
  const leoId = papa.url().match(/enfants\/([0-9a-f-]{36})/)[1];
  await papa.fill("#login", "leo"); await papa.fill("#password", "secret1");
  await papa.click("button:has-text('Créer')");
  await papa.waitForURL(/ok=/);
  ok(await papa.locator('#groupes [role="switch"][aria-checked="true"]').count() === 2, "Léo a rejoint les groupes de papa");
  await shot(papa, "enfant");
  await papa.goto(BASE + "/famille"); await shot(papa, "famille");

  // 4. Maman accepte l'invitation
  const mamanCtx = await ctx(); const maman = await mamanCtx.newPage();
  maman.on("pageerror", (e) => console.log("PAGEERROR maman", e.message));
  await maman.goto(invite);
  await shot(maman, "invitation");
  ok(await maman.locator("text=« Côté papa », « Toute la famille »").count() === 1, "l'invitation annonce les deux groupes");
  await maman.fill("#name", "Julie"); await maman.fill("#email", "maman@test.fr"); await maman.fill("#password", "motdepasse2");
  await maman.click("text=Créer mon compte");
  await maman.waitForURL(/bienvenue=1/);
  await maman.goto(BASE + "/famille");
  ok(await maman.locator("#groupes li", { hasText: "membre" }).count() === 2, "Julie a rejoint les deux groupes");

  // Onglet d'une personne sur la page de l'événement
  const tab = async (page, name) => {
    await page.locator('nav[aria-label="Pour qui ?"] a', { hasText: name }).click();
    await page.waitForURL(/pour=/);
  };
  const addIdea = async (page, title, extra) => {
    await page.locator('a:visible:text-is("+ Ajouter une idée")').first().click();
    await page.fill("#title", title);
    if (extra) await extra(page);
    await page.click("text=Ajouter l'idée");
    await page.waitForURL(/ok=/);
  };

  // 4 bis. Papa crée une idée pour Léo AVANT l'événement (elle part en réserve)
  await papa.goto(BASE + "/");
  await papa.locator("nav a:visible", { hasText: "Ma liste" }).first().click();
  await papa.locator('nav[aria-label="Choisir la liste"] a', { hasText: "Léo" }).click();
  await papa.waitForURL(new RegExp("/listes/" + leoId));
  await addIdea(papa, "Livre de dinosaures");
  ok(await papa.locator("#reserve", { hasText: "Livre de dinosaures" }).count() === 1, "idée sans événement rangée en réserve");

  // 5. Événement
  await papa.goto(BASE + "/evenements/nouveau");
  await papa.fill("#name", "Noël 2026"); await papa.fill("#date", date); await papa.fill("#end", dateFin);
  await papa.locator("label", { hasText: "Toute la famille" }).locator('input[name="groups"]').check();
  await shot(papa, "nouvel-evenement");
  await papa.click("text=Créer l'événement");
  await papa.waitForURL(/evenements\/[0-9a-f-]{36}$/);
  const eventUrl = papa.url();
  // L'idée en réserve est signalée sur l'événement et s'y ajoute en un clic
  await tab(papa, "Léo");
  await papa.locator("text=en réserve pour Léo").click();
  await papa.waitForURL(/listes/);
  await papa.locator("article", { hasText: "Livre de dinosaures" }).locator("text=Ajouter à Noël 2026").click();
  await papa.waitForURL(/ok=/);
  await papa.goto(eventUrl); await tab(papa, "Léo");
  ok(await papa.locator("article", { hasText: "Livre de dinosaures" }).count() === 1, "idée reportée sur l'événement");
  await shot(papa, "evenement-apres-report");

  // 6. Papa ajoute ses idées
  await papa.goto(BASE + "/");
  await papa.locator("a:visible", { hasText: "Ma liste" }).first().click();
  await addIdea(papa, "Perceuse sans fil", async (p) => {
    await p.fill('input[name="links"]', "www.example.com/perceuse");
    await p.fill("#price", "89,90");
    await p.selectOption("#priority", "2");
    await shot(p, "nouvelle-idee");
  });
  await addIdea(papa, "Casque audio");
  await shot(papa, "ma-liste");

  // 7. Maman prend la perceuse directement depuis l'accueil, participe au casque et suggère un livre secret
  await maman.goto(BASE + "/");
  await maman.locator("article", { hasText: "Perceuse" }).locator("text=Je le prends").click();
  await maman.waitForLoadState("networkidle");
  ok(await maman.locator("article", { hasText: "Perceuse" }).locator("text=Tu offres ce cadeau").count() === 1, "cadeau pris depuis l'accueil");
  await shot(maman, "accueil-apres-choix");
  await maman.goto(eventUrl); await tab(maman, "Seb");
  await maman.locator("article", { hasText: "Casque" }).locator("summary").click();
  await maman.locator("article", { hasText: "Casque" }).locator("input[type=number]").fill("40");
  await maman.locator("article", { hasText: "Casque" }).locator("text=OK").click();
  await maman.waitForLoadState("networkidle");
  await maman.locator('a:has-text("+ Suggérer une idée")').first().click();
  await maman.fill("#title", "Livre surprise");
  await shot(maman, "suggestion");
  await maman.click("text=Suggérer l'idée");
  await maman.waitForURL(/ok=/);
  await shot(maman, "evenement-maman");
  ok(await maman.locator("article", { hasText: "Livre surprise" }).count() === 1, "maman voit sa suggestion");

  // 8. Papa ne voit rien sur sa propre liste
  await papa.goto(eventUrl); await tab(papa, "Moi");
  await shot(papa, "evenement-papa");
  ok(await papa.locator("article", { hasText: "Perceuse" }).count() === 1, "papa voit sa perceuse");
  ok(await papa.locator("text=Livre surprise").count() === 0, "papa ne voit pas la suggestion secrète");
  ok(await papa.locator("article").filter({ hasText: /Tu offres|Choisi par|% pris|Tu participes/ }).count() === 0, "papa ne voit aucun état choisi");

  // 9. Léo
  const leoCtx = await ctx(); const leo = await leoCtx.newPage();
  await leo.goto(BASE + "/connexion");
  await shot(leo, "connexion");
  await leo.fill("#identifiant", "leo"); await leo.fill("#password", "secret1");
  await leo.click("text=Se connecter");
  await leo.waitForURL(BASE + "/");
  await shot(leo, "accueil-leo");
  await leo.locator("a:visible", { hasText: "Ma liste" }).first().click();
  await addIdea(leo, "Doudou licorne");

  await maman.goto(eventUrl); await tab(maman, "Léo");
  await maman.locator("article", { hasText: "Doudou" }).locator("text=Je le prends").click();
  await maman.waitForLoadState("networkidle");
  await leo.goto(eventUrl); await tab(leo, "Moi");
  await shot(leo, "evenement-leo");
  ok(await leo.locator("article", { hasText: "Doudou" }).count() === 1, "Léo voit son doudou");
  ok(await leo.locator("article").filter({ hasText: /Tu offres|Choisi par|% pris|Tu participes/ }).count() === 0, "Léo ne voit pas que le doudou est pris");

  // 10. Papa (parent) voit le choix sur la liste de Léo ; mes cadeaux de maman
  await papa.goto(eventUrl); await tab(papa, "Léo");
  ok(await papa.locator("details", { hasText: "Déjà choisies" }).locator("article", { hasText: "Doudou" }).count() === 1, "papa voit que le doudou est pris");
  await papa.goto(BASE + "/listes/" + leoId);
  ok(await papa.locator("article", { hasText: "Doudou" }).locator("text=Choisi par Julie").count() === 1, "la liste de Léo indique qui a choisi");
  await shot(papa, "liste-leo");
  await maman.locator("nav a:visible", { hasText: "J'offre" }).first().click();
  await maman.waitForURL(/j-offre/);
  await shot(maman, "j-offre");
  ok(await maman.locator("text=Perceuse sans fil").count() === 1, "mes cadeaux liste la perceuse");
  await maman.goto(BASE + "/");
  await shot(maman, "accueil-maman");
  await papa.goto(BASE + "/");
  await shot(papa, "accueil-papa");

  // 10 ter. Papa supprime la perceuse que Julie a choisie : elle est prévenue et garde son choix
  await papa.goto(BASE + "/");
  await papa.locator("nav a:visible", { hasText: "Ma liste" }).first().click();
  papa.once("dialog", (d) => d.accept());
  await papa.locator("article", { hasText: "Perceuse" }).getByLabel(/Supprimer/).click();
  await papa.waitForURL(/ok=/);
  ok(await papa.locator("article", { hasText: "Perceuse" }).count() === 0, "papa ne voit plus la perceuse supprimée");
  await maman.goto(BASE + "/");
  ok(await maman.locator("text=a été retiré d'une liste").count() === 1, "Julie est avertie sur l'accueil");
  ok(await maman.locator("article", { hasText: "Perceuse" }).count() === 0, "la perceuse n'est plus proposée à l'accueil");
  await maman.locator("text=a été retiré d'une liste").click();
  await maman.waitForURL(/j-offre/);
  ok(await maman.locator("li", { hasText: "Perceuse" }).locator("text=l'a retirée de sa liste").count() === 1, "J'offre : avertissement sur la perceuse");
  await shot(maman, "j-offre-avertissement");
  maman.once("dialog", (d) => d.accept());
  await maman.locator("li", { hasText: "Perceuse" }).locator("text=Annuler mon choix").click();
  await maman.waitForURL(/ok=/);
  ok(await maman.locator("li", { hasText: "Perceuse" }).count() === 0, "Julie a annulé son choix");

  // 10 bis. Mamie, invitée APRÈS la création de Noël, voit tout de suite l'événement et les idées
  await papa.goto(BASE + "/famille");
  await papa.locator("label", { hasText: "Toute la famille" }).locator('input[name="groups"]').check();
  await papa.click("text=Créer un lien d'invitation");
  await papa.waitForURL(/ok=/);
  const invite2 = await papa.locator("#invitations input[readonly]").first().inputValue();
  const mamieCtx = await ctx(); const mamie = await mamieCtx.newPage();
  await mamie.goto(invite2);
  await mamie.fill("#name", "Mamie"); await mamie.fill("#email", "mamie@test.fr"); await mamie.fill("#password", "motdepasse3");
  await mamie.click("text=Créer mon compte");
  await mamie.waitForURL(/bienvenue=1/);
  ok(await mamie.locator("h2", { hasText: "Noël 2026" }).count() === 1, "nouvelle arrivante : elle voit Noël");
  ok(await mamie.locator("article", { hasText: "Casque audio" }).count() === 1, "nouvelle arrivante : elle voit les idées de Seb");
  ok(await mamie.locator("text=Ta liste ici").count() === 1, "nouvelle arrivante : elle peut ajouter sa liste");
  await mamie.locator("a", { hasText: "Ta liste ici" }).click();
  await mamie.waitForURL(/evenements\/.*pour=/);
  ok(await mamie.locator("h2", { hasText: "Ma liste" }).count() === 1, "« Ta liste ici » mène à sa liste de l'événement");
  await mamie.goto(BASE + "/");
  await shot(mamie, "accueil-mamie");

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
