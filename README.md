# Pivotal

Handbal wedstrijdstatistieken. Registreer tijdens de wedstrijd goals, schoten, balverlies, saves, onderscheppingen en fouten per speler en team, bekijk daarna de statistieken en exporteer naar Excel.

Fase 1 draait in de browser en als geïnstalleerde Windows-app. Alle gegevens blijven lokaal in je browser, er is geen server of account nodig.

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
4. Pivotal opent nu in een eigen venster en staat in het startmenu.

De app werkt daarna volledig **offline**. Nieuwe versies worden automatisch opgehaald zodra je weer online bent en worden actief bij de volgende keer starten.

> Installeren werkt alleen op `localhost` of via HTTPS.

## Gebruik

1. **Teams**: maak teams aan en voeg spelers toe (rugnummer, naam, positie, keeper).
   Rugnummers zijn uniek per team.
2. **Wedstrijden**: maak een wedstrijd (thuis, uit, datum, plaats) en kies 2 helften of 3 derden.
3. **Live**: registreer acties met toetsenbord of muis.
4. **Statistieken**: filter op team, speler, actie en periode. Exporteer naar CSV.

### Toetsen op het live-scherm

| Toets | Actie |
|---|---|
| cijfers | rugnummer van het actieve team (Enter bevestigt direct) |
| `G` `S` `T` `V` `I` `F` | goal, schot, balverlies, save, onderschepping, fout |
| `A` | assist |
| `Shift+G` / `Shift+S` / `Shift+V` | 7m doelpunt / 7m niet op doel / 7m gestopt |
| `W` | 7m gekregen |
| `P` / `X` | passfout / technische fout |
| `Y` `M` `R` `B` | gele kaart, 2 minuten, rode kaart, blauwe kaart |
| `Tab` of `←` `→` | actief team wisselen |
| `Spatie` | klok start/pauze |
| `N` | volgende periode |
| `Ctrl+Z` | laatste actie ongedaan maken |
| `Esc` | selectie en positie wissen |

Een save zonder gekozen speler wordt toegekend aan de keeper op het veld. Stel per team onder "Keeper op het veld" in wie dat is; een goal en de 7m-uitkomsten (doelpunt, gestopt, niet op doel) worden automatisch toegekend aan de keeper van de tegenstander die dan op het veld staat. 7m-doelpunten tellen mee op het scorebord.

### Percentages

- **Schot%** per speler = (goals + 7m-goals) / (goals + missers + 7m-goals + 7m gestopt + 7m niet op doel). Zonder pogingen staat er "-".
- **Stop%** per keeper = stops / (stops + tegengoals). Daarnaast **7m stop%** en **totaal stop%** (veld en 7 meter samen).

### Seizoen en wedstrijdblad

- **Seizoen** (menu bovenaan): kies een seizoen (augustus–juli) en eventueel een team. Je ziet de uitslagen met ruststand en winst/gelijk/verlies, de totalen per speler over alle wedstrijden (met wedstrijden gespeeld en goals per wedstrijd) en de keepers. Met **Spelers (CSV)** exporteer je de seizoenstotalen.
- **Wedstrijdblad**: onder Statistieken van een wedstrijd staat **Wedstrijdblad (afdrukken)**: stand, ruststand, een tabel per team en de keepers, ingericht voor A4 liggend. Gebruik **Afdrukken / PDF** en kies "Opslaan als PDF" om er een PDF van te maken.

### CSV-export

Onder **Statistieken** staan twee knoppen: alle acties en spelersstatistieken. De bestanden zijn UTF-8 met BOM en gebruiken een **puntkomma** als scheidingsteken, zodat Nederlandse Excel ze direct goed opent. Wil je een komma, pas dan `CSV_DELIMITER` aan in `src/lib/csv.ts`.

Het spelersbestand heeft de oorspronkelijke kolommen vooraan; de nieuwe acties, `total_goals`, `shot_percentage` en de 7m-keeperwaarden staan erachter.

Het acties-bestand eindigt met `court_x_pct` en `court_y_pct`: de positie op het veld als geheel getal 0–100, vanuit het aanvalsperspectief van het team dat de actie deed (x=100 is het doel van de tegenstander, y loopt over de breedte). Leeg als er geen positie is opgeslagen.

## Gegevens en back-up

Gegevens staan in IndexedDB van de browser (per browser en per apparaat). Wis je de sitegegevens van de browser, dan zijn ze weg. Exporteer belangrijke wedstrijden daarom naar CSV.

## Stack

React, TypeScript, Vite, Dexie (IndexedDB), Tailwind CSS, Vitest, vite-plugin-pwa.

## Nog niet in fase 1

Video, tekenen op video, sequences, highlights, spraakbesturing, PDF-export, delen tussen coaches en Player Mode (CLUB). Mobiele/touch-optimalisatie volgt later.
