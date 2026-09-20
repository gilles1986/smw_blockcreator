# Welche Pieces uns noch fehlen — Auswertung des SMWCentral-Block-Archivs

Stand: 2026-09-20. Grundlage sind die Blöcke aus `D:\dev\smwresources` (419 von SMWCentral, 122 aus der Flux-Baserom) und die 48 Actions und 29 Conditions, die BlockCreator heute hat. Das Dokument sagt, was die Archiv-Blöcke tun, was davon schon mit unseren Pieces geht, und welche neuen Pieces sich lohnen, in welcher Reihenfolge.

## Kurzfassung

- Die meisten Archiv-Blöcke sind **„Auslöser + Wirkung"**: eine Bedingung (wer berührt von wo, mit welchem Zustand) und ein oder zwei Effekte. Genau das bilden unsere Slots, Conditions und Actions ab. Laut ihren Tags brauchen nur 40 von 419 Blöcken (12 % der Downloads) zusätzlich UberASM oder ein PIXI-Sprite; alle anderen bestehen aus Code im Block selbst.
- Unsere Pieces decken die **großen Mechaniken** schon ab: Shatter, Erase, Tile ändern, Teleport, Sprite spawnen, Boost, ON/OFF, P-Switch, Münzen geben, Musik, Nachricht.
- Es fehlen vor allem **Kleinteile rund um den Spielstand**: Münzen und Leben abziehen, Zeit addieren, Midway setzen, getragenes Item entfernen, Yoshi entfernen, und **Conditions auf Fortschritt** (Zeit, Bonussterne, Yoshi-Münzen, Events, Switch Palaces). Damit werden einige Dutzend Blöcke des Archivs baubar: Shops, Zölle, Schlüssel und Schlösser, Türen mit Bedingung, Zeit-Blöcke.
- Der größte einzelne Hebel ist **`Bounce block`** (Bounce-Sprite spawnen). Ohne ihn gibt es keinen Fragezeichen-, Ziegel- oder Notenblock. Der SMB3 Brick ist mit 4029 Downloads der zweitbeliebteste Einzelblock des Archivs (nach dem Switch Pack), und `%spawn_bounce_sprite()` wird im Archiv 53-mal aufgerufen.
- Drei Themen sind **keine Pieces, sondern Entscheidungen**: Zustand pro Block oder Level (Zeitverzögerung, Zähler, Doppelsprung), Begleitdateien (UberASM, Sprites) und ob Actions in mehr Slots erlaubt sein sollen. Siehe „Querschnittsthemen".

## Stand der Umsetzung (2026-09-20)

Umgesetzt ist alles außer den Begleitdateien (UberASM, PIXI-Sprites), die du ausgeschlossen hast, und den unten genannten Punkten. Die Bibliothek hat jetzt 98 Pieces (vorher 75) und 23 Presets (vorher 12).

| Paket                 | Neue Pieces                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A. Spielstand         | `take_coins`, `add_lives`, `take_lives`, `add_time`, `c_timer`, `add_bonus_stars`, `c_bonus_stars`, `set_midway`, `give_points`    |
| B. Fortschritt        | `c_yoshi_coins`, `c_events_passed`, `c_switch_palace`, `c_level_beaten`, `c_random`, `c_sprites_alive`                            |
| C. Items und Yoshi    | `remove_carried`, `kill_yoshi`, `set_yoshi_color`                                                                                 |
| D. Bounce             | `bounce_block`, dazu 11 Presets: `question_block_coin`, `question_block_powerup`, `brick_block`, `note_block`, `toll_block`, `key_lock`, `midway_block`, `bonus_star_goal`, `yoshi_coin_gate`, `no_yoshi`, `lava_bounce` |
| E. Ausgänge, Tempo    | `set_side_exit`, `exit_level_silent`, `limit_sprite_speed`, `behind_scenery`                                                      |

Weitere Änderungen:

- **Slot-Audit:** 31 Pieces (`kill_mario`, `hurt_mario`, `end_level`, `power_down`, `set_powerup`, `teleport`, `drop_item_box` und weitere Actions; alle Conditions, die nur globalen Zustand lesen, etwa `c_coins`, `c_lives`, `c_button`, `c_yoshi`) sowie `kill_all_sprites` laufen jetzt in jedem Slot. Ein Block, der Mario tötet, wenn ein Sprite ihn berührt, ist damit baubar. Die Muncher-Hitbox von `kill_mario` und `hurt_mario` gilt nur in Mario-Slots. Mario-Slots vorbehalten bleiben Pieces, die die Seite lesen: `boost_mario`, `stick_to_ceiling`, `reverse_direction`, `c_really_on_top`.
- **Erweiterungen:** `end_level` hat „Event + n" (`$1DEA`), `scroll_lock` eine Achse (horizontal, vertikal, beide), `boost_mario` die Richtung „in Blickrichtung". Die Vorgabewerte behalten das alte Verhalten, alte Blöcke öffnen sich unverändert.
- **Getestet** wird jedes Piece mit einem kleinen 65816-Interpreter (`core/testing/mini65816.ts`) auf einem Modell des RAM. Der Ziffern-Übertrag von `add_time`, alle Vergleiche von `c_timer`, die Bit-Suche von `c_yoshi_coins` und die Grenzen von `limit_sprite_speed` sind über alle Werte geprüft, und alle Pieces und Presets assemblieren mit dem Asar des GPS-Projekts.

Bewusst nicht umgesetzt, mit Grund:

| Was                                        | Warum nicht                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yoshi absteigen lassen (Force Yoshi Dismount) | Der Archiv-Block hängt sich mit `org $01ED44` in das ROM und springt mit Stack-Tricks in eine Routine. Ein Piece ist nur Code, ohne `org`.               |
| `save_game`                                | Der Archiv-Block hängt vom SRAM+-Patch ab und kopiert mit `MVN $7E,$7E`, was auf SA-1 nicht stimmt. Ohne beides zu prüfen könnte das Piece stumm falsch speichern. |
| ExAnimation-Trigger                        | Die Trigger liegen in `$7FC0FC`, freiem RAM in Bank `$7F`, das auf SA-1 woanders liegt. Ob Lunar Magic dort auf SA-1 dasselbe erwartet, konnte ich nicht prüfen. |
| `c_at_door`                                | Nicht nötig: „Mario steht an der Tür" ist `c_button` (Hoch, gedrückt) plus `c_on_ground`.                                                                 |
| `set_climbing`                             | Die Archiv-Blöcke (Invisible Vine) spawnen dafür einen Sprite, also eine Begleitdatei.                                                                     |
| Stufe 3 (Zeitverzögerung, Zähler, Doppelsprung) | Braucht die Einstellung „Freies RAM" (Abschnitt 6.2). Das ändert die Vorlagensprache und braucht eine Entscheidung, siehe Abschnitt 9.                |

`kill_yoshi` und `exit_level_silent` sind Abschriften von Archiv-Blöcken (SMWC 31301 und 19071), die wir nicht im Emulator ausprobiert haben; das steht in ihrer Beschreibung.

## 1. Was ich angesehen habe

| Quelle                                                   | Anzahl | Wie ausgewertet                                                                                                                       |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| SMWCentral-Blöcke (`downloads\blocks`, `resources.db`)   |    419 | Name, Tags, Beschreibung, Downloads; von 18 Blöcken den ASM-Code gelesen; alle 1804 `.asm` des Archivs auf RAM-Adressen gezählt |
| Flux-Baserom-Blöcke (`downloads\flux\block`)             |    122 | nur Namen und Dateiliste. Downloads gibt es nicht, aber jemand hat sie für eine Kaizo-Baserom ausgewählt                              |
| Discord-Ressourcen mit Block-Bezug                       |     37 | **nicht ausgewertet**                                                                                                                 |

Grenzen: Downloads sind ein Maß für Beliebtheit, nicht für Qualität. Das „Custom Useless Block Pack" (148 000 Downloads) zähle ich nicht mit, sonst zählt nichts anderes. Die Einteilung in Mechaniken habe ich über Schlagwörter im Namen gemacht, sie ist auf einige Blöcke genau, auf andere nur grob.

RAM-Adressen, die ich in der RAM-Map (SMWCentral, über die lokale Wissensdatenbank) nachgeschlagen habe, sind unten **geprüft**. Adressen, die nur aus dem Archiv-Code stammen, sind **zu prüfen**. Das Piece-Handbuch verlangt sowieso, jede Adresse nachzuschlagen, bevor sie in ein Piece kommt.

### Was die Blöcke im Archiv tun, in Zahlen

| Mechanik                      | SMWC | Flux | Downloads | brauchen UberASM/Sprite |
| ----------------------------- | ---: | ---: | --------: | ----------------------: |
| Teleport, Türen, Rohre        |   54 |    7 |    24 912 |                       5 |
| Shatter, Ziegel, Zerbröseln   |   40 |   10 |    25 515 |                       6 |
| ON/OFF, P-Switch, Schalter    |   35 |    9 |    21 652 |                       2 |
| Wasser, Lava, Eis, Sand, Wind |   28 |    4 |    20 668 |                       0 |
| Springen, Wandsprung, Klettern|   25 |    2 |    14 408 |                       2 |
| Powerup, Item, Leben          |   34 |    4 |    13 453 |                       3 |
| Passierbar, solide, Einbahn   |   15 |   23 |    12 134 |                       0 |
| Münzen, Sammelobjekte         |   28 |    5 |    11 823 |                       4 |
| Boost, Bounce, Tempo          |   18 |    8 |    10 727 |                       2 |
| Sprites spawnen               |   18 |   14 |    10 113 |                       3 |
| Verletzen, Töten              |   15 |    9 |     9 787 |                       1 |
| Schlüssel, Schlösser          |   14 |    2 |     8 038 |                       1 |
| Level beenden, Midway         |   20 |    5 |     7 378 |                       0 |
| Sprites beeinflussen          |   10 |    8 |     5 211 |                       2 |
| Yoshi                         |   12 |    4 |     4 887 |                       1 |
| Kamera, Scrollen              |   10 |    1 |     4 838 |                       1 |
| Shop, Bezahlen                |   14 |    0 |     4 746 |                       0 |
| Nachricht, Sound, Musik       |   10 |    3 |     4 235 |                       4 |
| Timer, Zeit                   |    8 |    1 |     2 933 |                       0 |
| Spieler, Figur                |    7 |    3 |     2 397 |                       3 |
| Events, Flags, Speicher       |    4 |    0 |     1 740 |                       0 |

## 2. Wie ein Archiv-Block zu Pieces wird

Ein Block im Archiv besteht fast immer aus drei Dingen, und jedes hat bei uns einen Platz:

| Im Archiv-Block                                                  | Bei uns                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| die Sprungtabelle: von wo und von wem er berührt wird           | der **Slot** (Mario oben, Sprite links, Fireball, …)                              |
| „nur wenn …": Münzen, Yoshi, Knopf, Zeit, Event                 | eine **Condition** im `if`                                                         |
| der Effekt: Münzen abziehen, Tile ändern, Sprite spawnen        | eine **Action**                                                                    |
| `!defines` am Dateianfang (`!Coins = 5`, `!Sound = $29`)        | die **Parameter** des Pieces, mit dem Define-Wert als Default                      |
| ein Block, der mehrere davon zusammensetzt (Zoll, Shop, Frage)  | ein **Preset**, also ein fertiger Block aus vorhandenen Pieces                     |

Das ist der Grund, warum ein Archiv-Block selten ein eigenes Piece ist. „Pay 5 Coins to Pass" ist keine neue Action, sondern `if Coins ≥ 5` + „Münzen abziehen" + „Act as". Was fehlt, sind die **Bausteine**, aus denen man solche Blöcke zusammensteckt.

## 3. Was schon geht, und was nicht

Vorhanden und im Archiv oft gebraucht: `erase_block` (265 Aufrufe im Archiv), `change_to_tile` (227), `spawn_sprite` (164), `create_smoke` (133), `shatter` (89), `glitter` (52), Conditions auf Knopf, Powerup, Yoshi, ON/OFF, P-Switch, Münzen, Leben, Item Box, Sprite-Art und -Zustand.

Die am häufigsten benutzten Adressen in den Archiv-Blöcken sind fast alle schon abgedeckt: `$1693` (Act as), `$187A` (Yoshi), `$148F` / `$1470` (trägt etwas), `$14AF` (ON/OFF), `$140D` (Spinjump), `$14AD` (P-Switch), `$0DC2` (Item Box) und die Sound-Ports `$1DFC` / `$1DF9`.

Die Lücken, nach dem, was sie blockieren:

| Lücke                                                                                    | Blockierte Blockfamilien (Beispiele, Downloads)                                                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Münzen oder Leben **abziehen**                                                           | Anti-Coin (628), Shops (837, 634, 251), Pay to Pass (351), Gamble (323), Anti-Moon (285)                                     |
| Bounce-Animation                                                                         | SMB3 Brick (4029), Question Blocks (2208, 762, 518), Note Blocks (631, 242), Bounce Blocks (1080, 1169), Trampolin (439)     |
| Getragenes Item **entfernen**                                                            | Key Lock Blocks (2913), Breakable With Key (551), Next Map16 Key (489), Remove Carried Item (358)                            |
| Conditions auf **Zeit, Bonussterne, Yoshi-Münzen, Events, Switch Palaces, Level beendet**| Time Block (367), Passable On Yoshi Coins (919), Event Based (410), Door if level beaten (538), Solid if all Palaces (543)   |
| **Yoshi** entfernen oder absteigen lassen                                                | Destroy Yoshi (1161), No Yoshi (491), Force Dismount (417), Hurt Yoshi (294)                                                 |
| Midway setzen oder löschen                                                               | Midway Point Blocks (747), Anti-Midway (186), Midway mit 50-Münzen-Teleport (245)                                            |
| **Zeit addieren**                                                                        | Add Time Blocks (680), Plus Clock (602), Ten Seconds Then Shatter (312)                                                      |
| Zufall                                                                                   | Gamble (323), Random Item (433), Random ? Block (353), Tricky Item Blocks (272)                                              |
| Sprite-Slot-Blöcke, die **Mario** treffen                                                | Kill Player on Sprite Contact (383), Race Against Death (330), End Level By Sprite (353)                                     |

Alles andere in den großen Familien (Conveyor, Wind, Quicksand, Lava, Eis, Walljump, Kanonen, Teleport-Varianten) lässt sich schon mit Boost Mario, Hurt Mario, `c_wall`, `c_button` und Spawn sprite zusammenstecken. Dort fehlen **Presets**, keine Pieces.

## 4. Kandidaten

Aufwand: **S** = ein kurzer Nachmittag (10 bis 20 Zeilen ASM, eine Adresse), **M** = ein Tag (mehrere Adressen, Sonderfälle), **L** = braucht eine Entscheidung oder neue Infrastruktur.

### Stufe 1: klein, gefragt, Adressen liegen vor

| #   | Piece                                              | Art       | Was es tut                                                                                                                                                       | Adresse / Routine                                          | Belege im Archiv                                                                         | Aufwand |
| --- | -------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------- |
| 1   | `take_coins` „Take coins"                          | Action    | Zieht 1 bis 99 Münzen ab. Parameter: Menge, **wenn zu wenig da ist** (auf 0 setzen / nichts tun). Für Zölle steht davor `c_coins`, das schon existiert.          | `$0DBF` (Münzen, schon im Einsatz)                         | Anti-Coin, Pay to Pass, 4 Shops, Gamble, Pay to End Level, Zero Coins (480)              | S       |
| 2   | `add_lives` / `take_lives`                         | Action    | Fügt N Leben hinzu (über den Inkrement-Zähler, also nacheinander) oder zieht N ab; bei zu wenig: nichts tun / Game Over / Mario töten                           | `$18E4` Lebens-Inkrement (**geprüft**), `$0DBE` (**geprüft**) | X-Up Pack (269), Life Stealer (209), Anti-Moon (285), Pay Lives (351), Shop Using Lives  | S       |
| 3   | `remove_carried` „Remove carried item"             | Action    | Lässt getragenes Item fallen **oder** löscht es (mit Rauch). Damit werden Schlüssel verbraucht.                                                                  | `$1470` / `$148F` (**geprüft**), Sprite-Status `$0B`       | Remove Carried Item (358), Remove Carryable (425), Key Locks (2913), Breakable With Key  | S       |
| 4   | `set_midway` „Midway point"                        | Action    | Setzt oder löscht das Midway-Flag, mit oder ohne Sound                                                                                                           | `$13CE` (**geprüft**), Sound `$1DF9`                       | Midway Point Blocks (747), Anti-Midway (186), Flux Silent Midway / Secondary Checkpoint  | S       |
| 5   | `add_time` „Add time"                              | Action    | Addiert Sekunden zur Zeit; bei mehr als 999 bleibt es bei 999. Beim Ziffern-Übertrag muss man aufpassen.                                                         | `$0F31`-`$0F33` (Ziffern, wie `set_timer`)                 | Add Time Blocks (680), Plus Clock (602), Ten Seconds Then Shatter (312)                  | M       |
| 6   | `c_timer` „Time left is"                           | Condition | Vergleicht die Restzeit (kleiner, gleich, größer)                                                                                                                | `$0F31`-`$0F33`                                            | Time Block (367), Teletimer (323), Teleport Based on Time Remaining (267)                | S       |
| 7   | `c_bonus_stars` + `add_bonus_stars`                | beide     | Bonussterne prüfen bzw. addieren (je Spieler)                                                                                                                    | `$0F48` + Spieler `$0DB3` (**geprüft**)                    | Pass On 99 Stars (264), Shatter On 50 Stars (202), Add a Bonus Star (322), Star Shop (275) | S       |
| 8   | `c_yoshi_coins` „Yoshi coins collected"            | Condition | Prüft, ob mindestens N Yoshi-Münzen im Level da sind. `$1420` zählt nur diesen Versuch: wer stirbt, verliert sie, das ist bei der „Passable On All"-Variante der Grund für einen zweiten Weg | `$1420` (**geprüft**), dauerhafte Bits **zu prüfen**       | Passable On Yoshi Coins (919), Passable On All 5 (500), Teleport on Yoshi Coins           | M       |
| 9   | `c_events` „Events passed" (+ `c_palace`)          | Condition | Anzahl bestandener Events; ob ein Switch Palace gedrückt ist                                                                                                     | `$1F2E` (**geprüft**), `$1F27`-`$1F2A` (**geprüft**)       | Event Based (410), Achievement Doors (583), Solid if all Palaces (543), Teleport if all Palaces (361) | S     |
| 10  | `c_level_beaten` „Level beaten"                    | Condition | Prüft, ob ein bestimmtes Level (Nummer) schon geschafft ist                                                                                                      | Level-Flags in `$1EA2`… **zu prüfen**                      | Door if level beaten (538), Horizontal Pipe on Levels Beaten (299)                       | M       |
| 11  | `bounce_block` „Bounce block"                      | Action    | Startet die Bounce-Animation. Parameter: Nummer des Bounce-Sprites, Richtung, Tile, in das der Block sich danach verwandelt (Eingaben laut Kopf der Routine: A, X, Y, `$03`/`$04`) | `%spawn_bounce_sprite()` (liegt im GPS, **uns fehlt der Aufrufer**); Tiles ab `$1C` brauchen den Custom-Bounce-Patch | Brick (4029, 855), Question Blocks (2208, 762, 518, 442), Note Blocks (631, 242), Bouncer (375) | M   |
| 12  | `c_random` „Chance"                                | Condition | Ist wahr mit einer Wahrscheinlichkeit 1 zu N                                                                                                                     | Zufallszahl `$148B` / `$148C` **zu prüfen**                | Gamble (323), Random Item (433), Random ? (353), Tricky Item Blocks (272), Roulette (332)| S       |

Was Stufe 1 freischaltet: **Zölle und Shops** (1, 2, 5), **Schlüssel und Schlösser** (3, mit dem vorhandenen `c_holding_sprite_id`), **Checkpoints** (4), **Türen und Blöcke mit Bedingung** (6 bis 10), **Fragezeichen-, Ziegel- und Notenblöcke** (11), **Glücksspiel** (12).

### Stufe 2: brauchbar, aber kleiner oder mit einem Haken

| #   | Piece                                                   | Art       | Was es tut                                                                                                                | Belege                                                                                       | Haken                                                                                          |
| --- | ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 13  | `yoshi` „Yoshi": absteigen, töten, entfernen            | Action    | Ein Piece mit Modus: Yoshi (und Baby-Yoshi, und was in seinem Maul ist) absteigen lassen, töten oder mit Rauch entfernen | Destroy Yoshi (1161), No Yoshi (491), Force Dismount (417), Hurt Yoshi (294), Kill Sprite in Mouth (Flux) | SA-1: der Absteige-Fall braucht Sonderbehandlung (`$CC`/`$CD`), das sieht man im Code von Force Yoshi Dismount |
| 14  | `set_yoshi_color`, `c_yoshi_color`                      | beide     | Farbe von Yoshi setzen oder prüfen                                                                                        | Yoshi color switch (615), Change Yoshi color (212)                                           | Adresse zu prüfen                                                                              |
| 15  | `save_game` „Save game"                                 | Action    | Speichert das Spiel, mit Sound                                                                                            | Save block (863), Paper Mario Save Block (523), Flux Save Game                                | Der Archiv-Block verhält sich anders, je nachdem, ob der SRAM+-Patch eingespielt ist (`read1($009B42)`). Das müssten wir als Option oder Hinweis abbilden |
| 16  | `limit_speed` „Limit speed"                             | Action    | Begrenzt die Geschwindigkeit von Mario oder Sprite (x, y)                                                                 | Sprite/Shell Speed Limiter (289), Downward Limiter (226), Freeze Block (293), Stop Block (302) | Zwei Varianten (Mario, Sprite), zwei Slot-Arten                                                |
| 17  | `set_climbing`, `behind_scenery`                        | Action    | Mario greift eine Ranke bzw. ist hinter der Landschaft (`$13F9`, **geprüft**)                                              | Ledge Vine (593), Horizontal Vine (447), Rope (434), Behind Vine (299), Fence/Net (458)      | Nicht untersucht, wie der Zustand zurückgesetzt wird, wenn Mario den Block verlässt            |
| 18  | `c_at_door` „Mario is at the door"                      | Condition | Wahr, wenn Mario an einer Tür steht und Hoch drückt (wie `%door_approximity()` im Archiv)                                  | Doors (1026), Hyper Door Collection (830), Exit Door (377): 41 Aufrufe im Archiv              | Die Tür-**Animation** mancher Blöcke braucht UberASM, wir kämen dann nur bis „teleportiert sofort" |
| 19  | `exanim_trigger`, `c_exanim_trigger`                    | beide     | Löst einen Lunar-Magic-ExAnimation-Trigger aus oder prüft ihn                                                              | LM 1.7+ Trigger Blocks (1178), Controller Block (614), Passcode (560)                        | Adresse zu prüfen; ohne passenden Trigger im Level passiert nichts, der Nutzer muss das wissen  |
| 20  | `c_sprites_on_screen`                                   | Condition | Wahr, wenn kein (oder mindestens ein) Sprite lebt                                                                          | Pass if no Sprites on Screen (508), Kill Sprite On-screen (461)                              | S                                                                                              |
| 21  | `give_points` „Give points"                             | Action    | Addiert Punkte zum Score                                                                                                   | `%give_points()` liegt im GPS, nur 6 Aufrufe im Archiv                                        | Geringer Bedarf; `give_points` addiert nur 1 Einheit                                            |

### Stufe 3: nur mit Infrastruktur, siehe unten

Verzögerte Effekte (Ziegel zerbröselt nach einer Weile, Toxic Block, Disappearing Block, Coin Outline), Zähler (Red Coins, Limited Spawner), Doppelsprung, Passwörter, Bildschirm-Rohre, Donut-Lifts. Dazu gehören die 40 Blöcke, die laut Tags UberASM oder Sprites brauchen, und einige, die nur freies RAM brauchen.

## 5. Bestehende Pieces erweitern

Eine neue **Version** mit einem zusätzlichen Parameter, dessen Default das alte Verhalten behält (das Handbuch sagt, warum: alte Blöcke öffnen sich unverändert).

| Piece            | Erweiterung                                                                                          | Grund im Archiv                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `end_level`      | Parameter „Event dazuzählen" (`$1DEA` + N), Option „ohne Overworld-Event"                            | Exit Adder (469), Exit Block no OW events (396), Side Exit (298) |
| `scroll_lock`    | Achse: horizontal (Default) oder vertikal (`$1412`)                                                   | Enable/Disable Vertical Scroll (591)                      |
| `boost_mario`    | Richtungsoptionen „in Blickrichtung" und „in gedrückter Richtung"                                     | Super Speed Block (735), Direction Block (363)             |

## 6. Querschnittsthemen

### 6.1 Slots: Actions, die Mario treffen, aber im Sprite-Slot sein sollten

`kill_mario`, `hurt_mario`, `end_level`, `power_down`, `stun_mario`, `set_powerup`, `set_item_box`, `star_power`, `drop_item_box`, `teleport`, `blink_invulnerability`, `disable_buttons` sind auf `mario` beschränkt. Geprüft: `kill_mario` und `hurt_mario` lesen mit der Option „Muncher-Hitbox" `$93` und `$94` und brauchen deshalb den Mario-Slot. `power_down`, `set_powerup`, `star_power`, `teleport`, `blink_invulnerability`, `drop_item_box`, `set_item_box`, `stun_mario` und `disable_buttons` lesen weder die Seite (`$93`, `$94`, `$96`, `$98`, `$9A`) noch Sprite-Tabellen, ihr Effekt gilt global. `end_level` schreibt nur `$141C` und `$1493`. Ein Block, der Mario tötet, wenn ein **Sprite** ihn berührt (Kill Player on Sprite Contact, Race Against Death, End Level By Sprite, zusammen 1066 Downloads), lässt sich heute nicht bauen.

Vorschlag: Slot-Audit. Für jedes Piece prüfen, ob der Code wirklich Mario-Kontext braucht. Wenn nicht, `slots: any`. Bei den beiden mit Hitbox-Option den Code mit `{{#if slot …}}` auf den Mario-Slot beschränken. Auch `kill_all_sprites` steht auf `sprite`; „Kill Sprite On-screen" (461) wird aber von Mario ausgelöst.

### 6.2 Zustand pro Block oder Level

Ein GPS-Block läuft nur, solange er berührt wird, und hat keinen eigenen Speicher. Alles, was „nach N Frames", „wenn Mario wieder runtergeht", „das dritte Mal" oder „insgesamt fünf" heißt, braucht **freies RAM, das jemand pro Level löscht**. Der Pay-to-Pass-Block aus dem Archiv sagt es offen: `!FreeRAM = $7C ; as long as it's cleared per level or such`.

Zwei Wege:

1. **Einstellung „Freies RAM"**: der Nutzer trägt eine Adresse (oder einen Bereich) ein, die er sicher hat, und ein Piece kann sie als `{{freeram}}` verwenden. Das Löschen pro Level muss er selbst (per UberASM) erledigen, wir schreiben es in die Anleitung.
2. **Item Memory** erweitern: wir haben schon `set_item_memory`, `bc_check_item_memory`, „Remember this block as collected". Das reicht für „ein Mal pro Block", nicht für Zähler.

Ohne eine Entscheidung dazu bleibt Stufe 3 zu. Das ist der wichtigste offene Punkt.

### 6.3 Begleitdateien (UberASM, PIXI-Sprites)

40 der 419 Blöcke brauchen sie, meist für Animation oder für etwas, das dauerhaft laufen muss (Donut Lift, Bildschirm-Rohre, 8-Wege-Kanonen, Disappearing Block, 32x32-Throw-Blöcke). Heute können Pieces nur **Routinen** mitbringen. Vorschlag: für v1 bewusst nicht. Wenn wir es später wollen, wäre der einfachste Weg ein weiteres Feld im Manifest (`companions`) und ein Ordner im Piece, den „Save to GPS project" ebenso vorsichtig kopiert wie Routinen.

### 6.4 Presets: fertige Blöcke aus vorhandenen und neuen Pieces

Presets sind die Antwort auf „ich will einen Fragezeichenblock". Wenn die Stufe-1-Pieces stehen, sind diese ohne weitere Arbeit im Editor baubar:

| Preset                                   | Zusammengesteckt aus                                                                          | Vorbild im Archiv                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| Fragezeichenblock (Münze, Item, Powerup-abhängig) | `bounce_block` + `spawn_sprite` / `give_coins` + `change_to_tile` + `c_mario_powerup` + Memory | Question Blocks (2208)                  |
| Ziegel                                   | `c_mario_powerup` (groß) → `bounce_block` + `shatter`, sonst nur Bounce                        | SMB3 Brick (4029)                       |
| Noten-/Bounceblock                       | `bounce_block` + `boost_mario` + `play_sound`                                                 | Bounce Blocks (1080)                    |
| Zollblock                                | `c_coins` ≥ N → `take_coins`, sonst `act_as` solide                                           | Pay 5 Coins to Pass (351)               |
| Shop                                     | `c_coins` → `take_coins` + `set_powerup` / `set_item_box`                                     | Shop Blocks (837)                       |
| Schlüssel und Schloss                    | `c_holding_sprite_id` → `remove_carried` + `erase_block`                                      | Key Lock Blocks (2913)                  |
| Midway (sichtbar / unsichtbar)           | `set_midway` + `play_sound`                                                                   | Midway Point Blocks (747)               |
| Ziel mit Bonusstern                      | `add_bonus_stars` + `end_level` + `shatter`                                                   | End Level and Add 1 Bonus Star (357)    |
| Durchgang nach N Yoshi-Münzen / Events   | `c_yoshi_coins` / `c_events` → `act_as`                                                       | Passable On Yoshi Coins (919)           |
| Teleport auf Bedingung (Zeit, Münzen, …) | `c_*` + `teleport`                                                                            | Teleport-Serie (10 Blöcke)              |
| Yoshi-Filter                             | `yoshi` (absteigen oder entfernen)                                                            | Force Yoshi Dismount (417)              |
| Förderband links/rechts (+ ON/OFF)       | `boost_mario` (Modus „addieren") + `c_onoff`                                                  | Custom Conveyor Blocks (1426)           |
| Wind, Treibsand, Lava, Eis               | `boost_mario` / `hurt_mario` / `water_slippery`                                               | Wind (1070), Quicksand (1294), SM64 Lava (1551) |
| Speicherblock                            | `c_button` (Runter) + `save_game`                                                             | Save block (863)                        |

## 7. Vorgehen und Reihenfolge

Pro Piece, in dieser Reihenfolge:

1. **Vorlage im Archiv** wählen (Nummer in `resources.db`, Ordner `downloads\blocks\block_<Nr>_<Name>`). Die `!defines` sind die Parameter, der Code nach `db $42` ist die Vorlage.
2. **Adressen nachschlagen** (RAM-Map). Alles, was nur aus dem Archiv-Code kommt, zählt als ungeprüft.
3. **Piece schreiben**, nach [piece-authoring-for-ai.md](../piece-authoring-for-ai.md). Das ist auch der erste echte Test des Handbuchs für AIs.
4. **Testen** wie bei den bestehenden Pieces: Vorlage mit Werten rendern und vergleichen, `npm test`, `npm run check:asar`.
5. **Preset** dazu, wenn der Block aus dem Archiv damit baubar wird.

Vorgeschlagene Pakete (jedes für sich lieferbar):

| Paket                    | Inhalt                                                                        | schaltet frei                                       |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| A. Spielstand            | 1, 2, 5, 6, 7 (`take_coins`, Leben, `add_time`, `c_timer`, Bonussterne)      | Shops, Zölle, Zeit-Blöcke                           |
| B. Fortschritt           | 8, 9, 10 (Yoshi-Münzen, Events, Level beendet, Palaces)                       | Türen und Blöcke mit Bedingung                      |
| C. Items und Yoshi       | 3, 13, 14 (`remove_carried`, `yoshi`)                                         | Schlüssel und Schlösser, Yoshi-Filter               |
| D. Bounce und Presets    | 11, 12, dazu Presets für Fragezeichen, Ziegel, Note, Zoll, Shop, Schlüssel    | die beliebteste Blockfamilie                        |
| E. Aufräumen             | 4, Slot-Audit (6.1), Erweiterungen (Abschnitt 5)                              | Midway, Sprite-Slot-Blöcke, Secret Exits            |

## 8. Bewusst nicht

- **Mehrteilige Blöcke und Grafiken** (32x32-Blöcke, Rohr-Sets: 90 der 419 Pakete bringen eigene Grafiken mit). BlockCreator baut Logik, keine Map16-Kacheln.
- **Neuheiten mit eigener Physik**: VVVVVV-Schwerkraft, Crash-Bandicoot-Kisten, Sonic-Monitore, Kirby-Bomben. Alles mit UberASM oder Sprites.
- **Passwort- und Reihenfolge-Rätsel** (Passcode, Keyhole Sequence): brauchen Zustand, siehe 6.2.
- **AddmusicK-Lautstärke** (Fader, Changer): braucht den AMK-Patch und Befehle, die das Handbuch nicht abdeckt.
- **Zwei-Spieler-Blöcke** (Character Switch 537, Player Specific 266). Kaizo-Hacks haben fast nie Luigi. Wenn es doch gebraucht wird, sind es zwei kleine Pieces auf `$0DB3` (**geprüft**).

## 9. Entscheidungen, die ich von dir brauche

1. **Freies RAM** (6.2): Einstellung „Freies RAM" einführen, ja oder nein? Das entscheidet, ob Stufe 3 (Zeitverzögerung, Zähler, Doppelsprung) je kommt.
2. **Slot-Audit** (6.1): Darf ich Pieces auf `any` erweitern, wenn ihr Code keinen Mario-Kontext braucht?
3. **Reihenfolge:** zuerst Paket A (Shops und Zölle) oder Paket D (Bounce und Fragezeichenblock)? Ich würde mit D anfangen, weil es die meisten Blöcke freischaltet, und A gleich danach.
4. **Begleitdateien** (6.3): für v1 ausgeschlossen lassen?
