# Backhand

Handbal wedstrijdstatistieken. Registreer tijdens de wedstrijd goals, schoten, balverlies, saves, onderscheppingen en fouten per speler en team, bekijk daarna de statistieken en exporteer naar Excel.

De app draait in de browser en als geïnstalleerde app. Alles werkt lokaal en offline; met een account (Supabase) kunnen coaches, assistenten en spelers van een team samenwerken en synchroniseert alles automatisch zodra er internet is. Zonder account is er geen server nodig.

## Starten (ontwikkelen)

Vereist Node.js.

```bash
npm install
npm run dev
```

Open daarna http://localhost:5173.

## Bouwen en testen

```bash
npm run build     # productiebuild in dist/
npm run test      # unit tests
npm run preview   # de productiebuild lokaal bekijken (http://localhost:4173)
```

## Installeren als Windows-app

De app is een PWA: je installeert hem vanuit de browser, zonder installer.

1. Draai de productiebuild: `npm run build` en daarna `npm run preview`
   (of zet de map `dist/` op een eigen webserver met HTTPS).
2. Open de app in **Edge** of **Chrome**.
3. Klik op het installatie-icoon in de adresbalk, of kies in het menu
   **Apps → Deze site als app installeren** (Edge) / **Opslaan en delen → Pagina als app installeren** (Chrome).
4. Backhand opent nu in een eigen venster en staat in het startmenu.

De app werkt daarna volledig **offline**. Nieuwe versies worden automatisch opgehaald zodra je weer online bent en worden actief bij de volgende keer starten.

> Installeren werkt alleen op `localhost` of via HTTPS.

## Gebruik

0. **Overzicht**: startscherm met de uitgelichte of live wedstrijd, topscorers, laatste wedstrijden en back-up.
1. **Teams**: maak teams aan en voeg spelers toe (rugnummer, naam, positie, keeper).
   Rugnummers zijn uniek per team. Onder "Spelerslijst plakken" importeer je een hele lijst in één keer
   (`nummer;naam;positie;K`, ook rechtstreeks uit Excel te plakken).
2. **Wedstrijden**: maak een wedstrijd (thuis, uit, datum, tijdstip, plaats, HVM thuis of uit, kleur tegenstander). Een wedstrijd heeft altijd 2 helften van 30 minuten.
3. **Live**: registreer acties op het tablet-scherm (zie hieronder).
4. **Statistieken**: filter op team, speler, actie en periode. Exporteer naar CSV.

### Statistieken en rapport
- **Statistieken**: twee tabellen, *Veldspelers* (16 kolommen) en *Keepers* (8 kolommen). Een lege cel betekent: geen gegevens (nooit "0"). Klik op een naam of waarde om de rij te markeren (kleur, vet en ▶); nog eens klikken heft het op. De naamkolom blijft staan bij horizontaal scrollen.
- Schotpercentage veldspelers = totaal doelpunten / totaal schoten op doel (doelpunten + missers + 7m-doelpunt + 7m-stop + 7m niet op doel). Keepers = totaal stops / totaal schoten op doel.
- **Heatmap**: elk team staat op zijn eigen helft (het team dat naar rechts aanvalt rechts), met teamnaam bij het doel en een kleurverloop in de teamkleur (licht = weinig, donker = veel). Zonder actiefilter telt alleen schoten en doelpunten.
- **Rapport** (knop Rapport bij de wedstrijd): voorkant = wedstrijd + stand, vergelijking, scoreverloop, keepers, per team de top 3 en de veldspelerstabel; achterkant = heatmap. **Afdrukken** geeft 2 A4-pagina's (staand). Onder het rapport (alleen op scherm) staan Nog invullen, doelvakken, notities en schotkaarten.

### Het live-scherm (tablet)

Het live-scherm is gemaakt voor een tablet liggend langs de lijn: grote knoppen, geen scrollen, donkere achtergrond. Op een telefoon blijft het bruikbaar (de kolommen komen onder elkaar).

- **Klok**: linksboven Start/Stop met een aftelklok van 30:00 naar 0:00. Altijd 2 helften. Op 0:00 stopt de klok en springt hij terug naar 30:00; ga met **+** naar de 2e helft (de klok blijft dan op 30:00 staan tot je op Start drukt). Met **−** ga je terug.
- **Stand** (midden boven): korte teamnamen, Thuis/Uit en de score. Eronder het helftvakje en de lijst met lopende **2-minutenstraffen** (`#12 uit 6:10, terug 8:10, nog 1:30`). De straftijd loopt mee met de klok en staat stil als de klok stilstaat.
- **HVM is altijd het eigen team.** Per wedstrijd stel je in of HVM thuis of uit speelt. Aan die kant staat de uitgebreide knoppenset (Doelpunt, 7 meter, Miss, Niet op doel, Fouten last: Pass fout / Technische fout / Onderschepping, en Block). De tegenstander heeft de simpele set (Doelpunt, Stop, Niet op doel, 7 meter).
- **Onderaan**: Geel, 2 Min, Rood, Blauw. **Ongedaan maken** staat onder het helftvakje (een penalty met rebound gaat in één keer terug), rechtsonder **Wedstrijd beëindigen**.
- **Geschiedenis** (links): alle acties, nieuwste bovenaan, met klok en stand. Tik op een actie om speler, keeper, positie of type aan te passen, of om hem te verwijderen (de stand rekent mee).
- **Timeout**: elk team heeft naast de teamnaam een knop. De klok stopt; jij drukt zelf op Start. Het aantal staat klein naast de knop; de momenten komen in het rapport.
- **Overslaan**: bij elke keuze van een speler of keeper kun je kiezen voor "Overslaan, invullen na de wedstrijd". De actie wordt wel opgeslagen en krijgt de markering "Nog invullen"; in het wedstrijdrapport staat een blok "Nog invullen" waar je alles aanvult.
- **Teamkleuren**: bij een nieuwe wedstrijd kies je per team een kleur. Die kleur wordt gebruikt op het live-scherm en in de statistieken. De tekst op de kleur is automatisch zwart of wit (minimaal 4,5:1 contrast).
- De klok loopt alleen niet door na Stop, Timeout, het einde van een helft of het einde van de wedstrijd; een sync die de klok per ongeluk stopt wordt direct hersteld.
- **Rechts**: topscorers van de tegenstander en van het eigen team, met doelpunten/schoten op doel, percentage en de positie waar de meeste doelpunten vandaan kwamen.
- Elke knop start een korte reeks keuzes (spelers kies je op nummer of naam; een onbekend rugnummer van de tegenstander voeg je direct toe). Zie *Scorestromen* hieronder.

#### Scorestromen

| Knop | Stappen |
|---|---|
| Doelpunt (eigen team) | speler, positie, assistgever (mag leeg) |
| Doelpunt (tegenstander) | eigen keeper die hem binnen kreeg, tegenstander, positie |
| 7 meter (eigen team) | speler die de fout onderging, tegenstander die de fout maakte, penaltynemer (top 3 als snelkeuze), uitkomst: Doelpunt / Niet op doel / Stop. Bij Stop: rebound of bal naar de tegenstander; bij een rebound een nieuwe schutter met Doelpunt / Mis / Niet op doel |
| 7 meter (tegenstander) | tegenstander die de fout onderging, eigen speler die de fout maakte, penaltynemer, uitkomst. Bij Stop: welke eigen keeper, daarna rebound of bal terug |
| Miss, Niet op doel, Pass fout, Technische fout, Onderschepping, Block | alleen een eigen speler |
| Stop (tegenstander) | welke eigen keeper stopte |
| 2 Min / Geel / Rood / Blauw | welk team, speler of staflid; bij 2 Min start de aftelling |

Posities: Links Hoek (LH), Rechts Hoek (RH), Links opbouw (LO), Rechts opbouw (RO), Midden (M), Cirkel (C), Keeper (K), 2e Cirkel (CC), Break (Br), Penalty 7 meter (P). De positie wordt alleen bij een doelpunt gevraagd (een 7 meter-doelpunt is automatisch P). Elke code heeft een vaste plek op het veld, zodat de heatmap ook nieuwe doelpunten laat zien.

Een goal en de 7m-uitkomsten worden toegekend aan de eigen keeper die je bij de stroom kiest; die keeper blijft daarna de keeper op het veld. 7m-doelpunten tellen mee op het scorebord.

#### Voor de wedstrijd

- **Wedstrijden → Nieuwe wedstrijd**: datum, tijdstip, plaats, de twee teams, *HVM speelt thuis/uit* en de kleur van de tegenstander (standaard oranje; HVM is teal).
- **Wedstrijden → Voorbereiding** (ook op het live-scherm): selecteer wie speelt; niet-spelende spelers krijgen een reden (Afwezig, Blessure, Niet in selectie). Kies zelf de top 3 penaltyschutters. Vul de spelerslijst van de tegenstander aan (rugnummer, naam en positie optioneel); dat kan ook tijdens de wedstrijd.
- **Teams**: per team een korte naam (voor het scorebord) en de staf met rol (eerste trainer, tweede trainer, assistent, ...). Stafleden en trainers kunnen een 2-minutenstraf of kaart krijgen.

#### Instellingen die nog open staan

In `src/lib/clock.ts` staat per open klantvraag één constante: `TRACK_SUBSTITUTIONS` (wissels bijhouden: nee), `PENALTY_TIME_DISPLAY` (straftijd als gespeelde minuten) en `PENALTY_CARRIES_OVER` (een straf loopt door in de volgende helft: ja).

### Percentages

- **Schot%** per speler = (goals + 7m-goals) / (goals + missers + 7m-goals + 7m gestopt + 7m niet op doel). Zonder pogingen staat er "-".
- **Stop%** per keeper = stops / (stops + tegengoals). Daarnaast **7m stop%** en **totaal stop%** (veld en 7 meter samen).

### Seizoen en wedstrijdblad

- **Seizoen** (menu bovenaan): kies een seizoen (augustus–juli) en eventueel een team. Je ziet de uitslagen met ruststand en winst/gelijk/verlies, de totalen per speler over alle wedstrijden (met wedstrijden gespeeld en goals per wedstrijd) en de keepers. Met **Spelers (CSV)** exporteer je de seizoenstotalen.
- **Wedstrijdblad**: onder Statistieken van een wedstrijd staat **Wedstrijdblad (afdrukken)**: stand, ruststand, een tabel per team en de keepers, ingericht voor A4 liggend. Gebruik **Afdrukken / PDF** en kies "Opslaan als PDF" om er een PDF van te maken.

### Statistiekenscherm en spelerspagina

- Bovenaan staat de scorekop met eindstand en ruststand, daarna een **vergelijking** van beide teams (balken) en het **scoreverloop** met de topscorers van de wedstrijd.
- Het **Overzicht** en het **Seizoen** tonen wat het eigen team scoorde tegenover de tegenstander (bijvoorbeeld 5 tegen 3), niet het totaal van beide teams.
- Klik op een speler (Overzicht, Seizoen of topscorers) voor de **spelerspagina**: doelpunten, schoten op doel en percentage, assists, blocks, onderscheppingen, balverlies, fouten, kaarten en straffen, penalty's (genomen, raak, gestopt, gekregen, veroorzaakt), doelpunten per positie, keeperstatistieken, een fijne heatmap en alle wedstrijden.
- Een wedstrijd telt als **live** zolang de laatste actie minder dan 3 uur geleden is, tenzij je hem met **Wedstrijd beëindigen** (live-scherm) hebt afgerond. **Heropenen** zet hem terug. Live wedstrijden staan op het Overzicht en hebben een badge in de lijst.

### Back-up

Op het Overzicht staat **Back-up maken** (JSON-bestand met alles) en **Back-up terugzetten**. Terugzetten vervangt alle gegevens in deze browser; het bestand wordt eerst gecontroleerd. Zo neem je gegevens ook mee naar een ander apparaat.

### CSV-export

Onder **Statistieken** staan twee knoppen: alle acties en spelersstatistieken. De bestanden zijn UTF-8 met BOM en gebruiken een **puntkomma** als scheidingsteken, zodat Nederlandse Excel ze direct goed opent. Wil je een komma, pas dan `CSV_DELIMITER` aan in `src/lib/csv.ts`.

Het spelersbestand heeft de oorspronkelijke kolommen vooraan; de nieuwe acties, `total_goals`, `shot_percentage` en de 7m-keeperwaarden staan erachter.

Het acties-bestand heeft `court_x_pct` en `court_y_pct`: de positie op het veld als geheel getal 0–100, vanuit het aanvalsperspectief van het team dat de actie deed (x=100 is het doel van de tegenstander, y loopt over de breedte). Leeg als er geen positie is opgeslagen. Daarachter staan `position_code` (LH, RH, ...), `assist_by`, `fouled`, `fouler`, `staff_member` en `rebound`. Het spelersbestand heeft ook kolommen voor `block` en `off_target`.

## Gegevens en back-up

Gegevens staan in IndexedDB van de browser (per browser en per apparaat). Wis je de sitegegevens van de browser, dan zijn ze weg. Exporteer belangrijke wedstrijden daarom naar CSV.

## Stack

React, TypeScript, Vite, Dexie (IndexedDB), Tailwind CSS, Vitest, vite-plugin-pwa en Supabase (inloggen, teamrollen en synchronisatie; de app blijft offline werken).

## Nog niet in fase 1

Video, tekenen op video, sequences, highlights, spraakbesturing, PDF-export, delen tussen coaches en Player Mode (CLUB). Mobiele/touch-optimalisatie volgt later.
