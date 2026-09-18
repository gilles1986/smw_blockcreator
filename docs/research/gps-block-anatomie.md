# GPS-Block-Anatomie — Recherche für den Block Creator

Stand: 2026-09-18. Reine Faktensammlung (kein Tool-Design). Jede Aussage nennt ihre Quelle.
Abkürzungen für häufig zitierte Pfade:

| Kürzel | Pfad |
|---|---|
| `GPS/` | `D:\Games\Kaizo\Rooms-For-A-Friend\tools\GPS\` (GPS 1.4.4, siehe `GPS/main.asm:1`) |
| `README` | `D:\Games\Kaizo\Rooms-For-A-Friend\tools\Docs\GPS\README.txt` |
| `ARCH/` | `D:\dev\smwresources\downloads\blocks\` (SMWCentral-Archiv) |
| `DISASM/` | `D:\Games\Kaizo\SMW MCP\SMWSources\` (SMWDisX-Disassembly, US-Version; Symbole in `SMW_U.sym`) |
| `RAMDUMP` | `D:\Games\Kaizo\SMW MCP\rom_ram_docs.html` (lokaler Dump der SMWCentral-RAM-Map; Wertelisten stecken im `data-modal`-Attribut) |
| `CLI` | `node "D:\Games\Kaizo\SMW MCP\smw-knowledge-mcp-server\dist\cli.js" memory <addr>` |

Hinweis zur CLI: `memory` funktioniert nur mit sechsstelligen Adressen (`7E0019`, nicht `19`); `--details` und `smwcentral-ram` lieferten „(no matches)“. Wertelisten habe ich deshalb direkt aus `RAMDUMP` gelesen. Lokale Label-Namen der CLI sind teils falsch zugeordnet (z. B. „BluePSwitchTimer“ für `$1497`); maßgeblich ist jeweils der SMWCentral-Text.

---

## 1. Block-Anatomie in GPS

### 1.1 Header und Sprungtabelle

Vorlage (`GPS/blocks/template.asm:1-5`):

```asm
db $42 ; or db $37
JMP MarioBelow : JMP MarioAbove : JMP MarioSide
JMP SpriteV : JMP SpriteH : JMP MarioCape : JMP MarioFireball
JMP TopCorner : JMP BodyInside : JMP HeadInside
; JMP WallFeet : JMP WallBody ; when using db $37
```

- Das erste Byte ist der Header; danach folgen 3-Byte-`JMP`s. GPS springt an `Blockstart + id*3 + 1` (`GPS/main.asm:11` `LDA.w <id>*3+1`, `main.asm:120-123` addiert das auf den Blockzeiger). Die **Namen der Labels sind frei** – nur die Position in der Tabelle zählt (z. B. heißen sie in `GPS/blocks/question_blocks/question_block_base.asm:3-7` `MarioCorner`, `MarioInside`, `WallRun`, `WallFeet`).
- `db $42`: 10 Offsets (IDs `$00`–`$09`). `db $37`: 12 Offsets, zusätzlich `WallFeet`/`WallBody`. GPS ruft Offsets mit Sprungweite ≥ `$1E` (also ID `$0A` → `$1F`, ID `$0B` → `$22`) nur auf, wenn das Header-Byte `$37` ist, sonst `RTL` ohne Blockcode (`GPS/main.asm:106-117`).
- GPS bricht mit Fehler ab, wenn kein `db $42`/`db $37` am Anfang steht (String in `GPS/gps.exe`: „lacks a db $42 or db $37 header“). README bestätigt: alle `db $42`-Blöcke (BTSD) sind kompatibel (`README:12`, `README:83-85`).

### 1.2 Offset-Reihenfolge und Hijack-Adressen

Aus `GPS/main.asm:17-19` (Lunar-Magic-Hijack-Slots → Offset-ID):

| Pos./ID | Label (Template) | LM-Slot | Wann (Interaktionspunkt) |
|---|---|---|---|
| 0 / `$00` | MarioBelow | `$06F690` | Mario berührt den Block von **unten** (Kopfpunkt). `$77`-Doku: „^ – tile above Mario (MarioBelow / HeadInside)“ (`RAMDUMP` L1072) |
| 1 / `$01` | MarioAbove | `$06F6A0` | Mario steht/landet **auf** dem Block (Fußpunkt). „v – tile below Mario (MarioAbove)“ (`RAMDUMP` L1072) |
| 2 / `$02` | MarioSide | `$06F6B0` | Seite von Marios Körper. „< / > (MarioSide)“ (`RAMDUMP` L1072) |
| 3 / `$03` | SpriteV | `$06F720` | Sprite-Vertikalcheck (unten wenn fallend/stehend, oben wenn steigend, `DISASM/bank_01.asm:2646-2650`) |
| 4 / `$04` | SpriteH | `$06F730` | Sprite-Horizontalcheck (`DISASM/bank_01.asm:2591-2613`) |
| 5 / `$05` | MarioCape | `$06F780` | Capeschlag trifft Block |
| 6 / `$06` | MarioFireball | `$06F7C0` | Marios Feuerball berührt Block |
| 7 / `$07` | TopCorner | `$06F6C0` | obere Ecke/Kante des Blocks an Marios Fußbereich (siehe Gotchas) |
| 8 / `$08` | BodyInside | `$06F6D0` | Körpermitte in Block. „M – Mario is inside of a tile (BodyInside)“ (`RAMDUMP` L1072) |
| 9 / `$09` | HeadInside | `$06F6E0` | Kopfbereich (Seite des Kopfes). `$74`-Doku: „h – Side of head … (HeadInside)“ (`RAMDUMP` L1042) |
| 10 / `$0A` | WallFeet | `$06F7D0` | Wall-Run (Mario läuft an Wand) – nur `db $37` |
| 11 / `$0B` | WallBody | `$06F7E0` | Wall-Run – nur `db $37` |

Zusatz-Hijacks: `$06F67B` fügt die Wall-Run-Aufrufer in LMs „CMP-BEQ-Liste“ ein, `$06F717` behebt einen SpriteH-Bug (`GPS/main.asm:39-43`, `62-79`). Daraus folgt: **LM entscheidet über den Offset anhand dessen, welche Vanilla-Routine den Tile gerade liest** (Rücksprungadresse, `main.asm:63` Kommentar „JSR [($00EB3A-1)&$0000FF]“). **unverifiziert:** Die Kommentare in `main.asm:66` („Wall feet“ am `#$EA`-Zweig → `$06F7E0`) widersprechen `main.asm:19` (`$06F7D0` = WallFeet). Welcher Wandpunkt welcher ist, habe ich nicht aufgelöst.

### 1.3 Zustand beim Eintritt (Register/RAM)

Aus `GPS/main.asm:7-15` und `81-128`:

- Hijack-Makro: `PHB : PHX`, `REP #$30`, `JSL block_execute`, danach `PLX : PLB : JMP $F602` (`main.asm:9-14`). Der Block-`RTL` kehrt also direkt in dieses Makro zurück.
- Vor dem Sprung: `SEP #$30` → **A, X, Y 8-bit** (`main.asm:124`).
- **DB = Bank des Blocks** (`main.asm:91-93` legt die Bank auf den Stack, `main.asm:126` `PLB ; bank byte of block`). Tabellen im Block sind daher mit absoluter Adressierung lesbar (Beispiel `LDA Coins,x` in `ARCH/block_4004_Powerup_Conditional_Coin/powerconditionalcoin.asm:11,17`).
- **X = `$15E9`** (`main.asm:127` `LDX $15E9|!addr`). `$15E9` = Index des gerade verarbeiteten Sprites; gilt für normale und Extended Sprites (`CLI memory 7E15E9`). In SpriteV/SpriteH also Sprite-Slot, in MarioFireball Extended-Sprite-Slot (vgl. `GPS/routines/fireball_smoke.asm:6` `STZ $170B|!addr,x`). In Mario-Offsets ist X ein Rest-Wert ohne Bedeutung.
- **`$1693` = Low-Byte, Y = High-Byte des „Acts like“** des Tiles; **`$03/$04` = echte 16-bit-Map16-Nummer** (`CLI memory 7E1693`, SMWCentral-Text; `main.asm:87` `LDX $03` nutzt `$03` als Blocknummer). Beleg aus der Praxis: `GPS/blocks/base/SpawnCarryableSprite.asm:41-44` liest `$1693` und unterscheidet so die in `list.txt:78-83` vergebenen Act-as-Werte `049`–`04E`.
- A: beim Eintritt unbestimmt (Rest aus `main.asm:121-123`). **unverifiziert**, ob A beim Rücksprung eine Rolle spielt.
- `$98-$99` / `$9A-$9B` = Y/X-Position des aktuell geprüften Interaktionspunktes (`CLI memory 7E0098`). Für Mario ≈ Blockposition; für Sprites **nicht** – dort stehen die Sprite-Kontaktkoordinaten in `$0A-$0D`, und `%sprite_block_position()` kopiert sie nach `$98-$9B` und `$185E`→`$1933` (`GPS/routines/sprite_block_position.asm:2-13`, Kommentar „so it doesn't react to where the player's at“; ebenso `GPS/blocks/base/one_way_right_sprite.asm:18-20`).
- `$1933` = verarbeiteter Layer (0 = L1, 1 = L2/3) (`CLI memory 7E1933`). Bei Layer-2-Blöcken sind `$94/$96` relativ zu Layer 2 (`CLI memory 7E0094`).

### 1.4 Pflicht beim Verlassen

- **`RTL`** (Template endet mit `RTL`, `template.asm:23`; Hijack nutzt `JSL`, `main.asm:12`).
- **Index-Register 8-bit zurückgeben**: das Makro macht `PLX` im selben Modus wie das `PHX` davor (`main.asm:9`, `13`). Die GPS-Routinen-Doku zeigt das Muster `REP #$10 … SEP #$10` (`GPS/routines/change_map16.asm:5-8`). (Ableitung, im Emulator nicht getestet.)
- **Y erhalten**, sofern man das Act-as nicht ändern will – Y *ist* das High-Byte. Kommentar in `GPS/blocks/global/hurt_death.asm:52` („y is used for act as -> preserve it“) und `hurt_death.asm:89-92` (PHY/PLY um HurtMario).
- X darf verändert werden (Makro stellt es per `PLX` wieder her, `main.asm:13`), aber innerhalb von Sprite-Code braucht man X als Sprite-Index → vor Routinen, die X zerstören, `PHX/PLX` (Muster: `GPS/blocks/global/sprite_killer.asm:28-30`).

### 1.5 Gotchas pro Offset

- **Offsets feuern jeden Frame und pro Interaktionspunkt.** Die Vanilla-Engine liest Tiles über `CODE_00F44D` → `JSL CODE_00F545` (`DISASM/bank_00.asm:13266`, `13342-13353`); jeder Lesevorgang eines Punktes löst den Offset aus. Folge: mehrere Punkte auf demselben Block → Code läuft mehrfach pro Frame. Belege: `ARCH/block_13508_Wind_blocks/readme.txt:4-9` („multiple collision points … at once in every frame. And each of them executes a block code“), `ARCH/block_18347_Controller_Execute_Once_Blocks/readme.txt:10-14`, `28-31` (Punkte werden *sequenziell* abgearbeitet, Reihenfolge entscheidet). Blöcke schützen sich durch Zustandsprüfung, z. B. `GPS/blocks/on_off/set_to_on.asm:27-30` (nur umschalten, wenn noch OFF) oder durch Sofort-Löschen (`GPS/blocks/base/Collectable.asm:17-18`).
- **Seitliche Punkte alternieren**: Laut `ARCH/block_16917_Reverting_Map16_Blocks_v2.0.3/readme.html` (Abschnitt „Mario's … horizontal … collision points“, ca. Z. 100) laufen links/rechts nicht im selben Frame, sondern abwechselnd. Für Sprites belegt: ohne X-Geschwindigkeit wählt die Seite `TrueFrame & 1` (`DISASM/bank_01.asm:2594-2599`, `2613-2615`). Für Mario **unverifiziert** (in `CODE_00EB77`, `bank_00.asm:12041-12066`, wird die Seite aus Marios X-Position im Block bestimmt).
- **Mario-Seite ohne Überlappung**: Vanilla-Munchers verletzen seitlich nur bei echter Überlappung. Lokale Blöcke prüfen daher `$93`/`$94` gegen eine Tabelle `db $02,$0D` (`GPS/blocks/global/hurt_death.asm:47-58`, gleiches Muster in `teleport.asm`, `set_to_on.asm`). `$93` = Seite des Blocks, auf der Mario ist (0 rechts, 1 links) (`CLI memory 7E0093`). Das Archiv kritisiert Blockreator genau dafür (`ARCH/block_41222_Black_Piranha_Plant_(Muncher)_v1.1/VanillaMuncher.asm:4-7`).
- **TopCorner / MarioAbove**: feuern auch, wenn Mario seitlich an der Oberkante vorbeifällt oder schräg in die Ecke kommt. Blöcke, die „wirklich draufstehen“ meinen, prüfen `$7D` (Y-Speed ≥ 0) plus Höhe: `($98 & $FFF0) - $1C >= $96` (`GPS/blocks/global/donut_lift.asm:12-22`, Kommentar erklärt die 4-Pixel-Toleranz; gleich in `GPS/blocks/base/DeathTransformBlock.asm:33-42`).
- **Sprite-Offsets nur mit Objektinteraktion**: Sprites mit gesetztem Bit 7 in `$1686` (`SpriteTweakerE`) prüfen keine Tiles (`DISASM/bank_01.asm:2582-2584` `LDA SpriteTweakerE,X : BMI Return`; Adresse `$1686` laut `DISASM/SMW_U.sym` Z. 11987). `GPS/blocks/global/sprite_killer.asm:56` nennt das als Einschränkung.
- **SpriteV-Richtung**: Y-Speed ≥ 0 → Punkt unten; < 0 → Punkt oben (`DISASM/bank_01.asm:2646-2650`). `GPS/routines/check_sprite_kicked_vertical.asm:5-6` wertet dafür `!AA,x` aus.
- **Sprite-Positions-Falle**: in SpriteV/H `%sprite_block_position()` aufrufen, bevor man `%erase_block()`, `%change_map16()`, `%glitter()` o. ä. benutzt (siehe 1.3; Muster in `question_block_base.asm:45-47`).
- **Cape**: `question_block_base.asm:49-51` behandelt Cape wie MarioBelow (Block wird „getroffen“, `$98/$9A` also nutzbar). **unverifiziert:** Inhalt von X bei MarioCape.
- **Fireball**: X = Extended-Sprite-Slot; `%fireball_smoke()` löscht den Feuerball (`STZ $170B,x`) und setzt Rauch (`GPS/routines/fireball_smoke.asm:6-28`).
- **Wall-Offsets** nur mit `db $37` (1.1). Lokale Blöcke, die Mario auch beim Wall-Run treffen sollen, setzen sie explizit (`hurt_death.asm:20-22`, `62-67`).
- **Block-Größe**: max. eine Bank (gps.exe-String „exceeds the size of a bank“).

---

## 2. „Act as“ zur Laufzeit

### 2.1 Mechanik

Schreiben von `$1693` (Low) **und** Y (High) ändert, wie die Engine den Tile für *diesen* Interaktionspunkt in *diesem* Aufruf behandelt (`CLI memory 7E1693`: „Writing to it (and Y) will change how things interact with the block“). Kanonisch (`GPS/blocks/base/one_way_up_sprite.asm:24-27`):

```asm
LDY #$01        ; act as $130 (High)
LDA #$30        ; (Low)
STA $1693|!addr
RTL
```

Weitere lokale Belege: Luft für Mario `LDY #$00 : LDA #$25 : STA $1693|!addr` (`GPS/blocks/global/mario_passable.asm:9-12`), Luft für Sprites (`sprite_passable.asm:9-12`), bedingt (`on_off/passthrough_when_off.asm:8-12`, `base/sprite_solid.asm:16-25`).

Vanilla-Seite: die Engine liest High-Byte (A) und Low-Byte (`$1693` = `Map16TileNumber`, `DISASM/SMW_U.sym` Z. 9760) in `CODE_00F4CD` und gibt nach `JSL CODE_00F545` `LDY $1693 : CMP #$00` zurück (`DISASM/bank_00.asm:13342-13353`). Danach entscheidet nur „High-Byte 0 oder ≠0“ plus Low-Byte über das Verhalten (Bereichsvergleiche `CPY #$11 / #$6E / #$D8 / #$FB`, siehe 2.2).

Im Archiv (515 `.asm`-Dateien schreiben `$1693`) kommen am häufigsten vor: `$025` (296×), `$130` (132×), `$137` (6), `$1030` (5, siehe Gotcha), `$01F` (5), `$100` (4), `$00B` (4), `$129` (4), `$02C`, `$11E` (je 3), `$13F`, `$02B`, `$12F` (je 2), `$1D8`, `$006`, `$138` (je 1). (Auszählung per `grep -B3 'ST[AXY] $1693'` über `ARCH/`, Heuristik: letztes `LDY #`/`LDA #` vor dem Store.)

### 2.2 Bedeutung der wichtigen Tiles (aus Disassembly verifiziert)

| Act-as | Mario | Sprites | Quelle |
|---|---|---|---|
| `$025` | Luft (Seite 0, nicht solide) | Luft | Außerhalb des Levels liefert die Engine selbst `LDY #$25` (`DISASM/bank_00.asm:13314-13316`); `$9C=$02` erzeugt „Empty (025)“ (`RAMDUMP` `$7E009C`; `DISASM/bank_00.asm:7389-7391`) |
| `$100`–`$110` | Ledge: nur von oben solide (Kopf: `CPY #$11 : BCC` → kein Stoß, `bank_00.asm:12215-12217`; Seite: `CPY #$11 : BCC` → nicht blockiert, `bank_00.asm:12075`) | nur von oben (Top-5-Pixel-Check, `bank_01.asm:2705-2707`, `2767-2770`) | Disassembly |
| `$111`–`$16D` (z. B. `$130` Zementblock) | voll solide | voll solide, auch von unten (`bank_01.asm:2658-2668`) und seitlich (`bank_01.asm:2618-2624`) | Disassembly |
| `$12F` | **Muncher**: im Solid-Bereich, und `CODE_00F127` ruft bei Low-Byte `$2F` `HurtMario` auf – außer Mario reitet Yoshi und steht oben (`CODE_00F120` prüft `$187A`) (`DISASM/bank_00.asm:12784-12813`). Unter Silber-P-Switch wird `$12F` zur Münze `$2B` (`bank_00.asm:13442-13456`). Bestätigt als „vanilla muncher … tile $12F“ (`ARCH/block_41222_…/VanillaMuncher.asm:1-2`) | solide | Disassembly + Archiv |
| `$16E`–`$1D7` | Schrägen | Schrägen | `bank_00.asm:12218-12219`, `bank_01.asm:2709-2711` |
| `$1D8`–`$1FA` (z. B. **`$1F0`**) | **durchlässig**: Füße prüfen den Tile darüber; ist das keine Schräge → kein Boden (`CPY #$D8 … JSR CODE_00F461 … BEQ/BCC CODE_00EDE9`, `bank_00.asm:12315-12329`); seitlich nicht blockierend (≥ `$6E`, `bank_00.asm:12075-12078`) | **von oben begehbar**: `CMP #$D8 : BCS CODE_019386` schiebt das Sprite pixelweise nach oben, solange es in den oberen 5 Pixeln steckt (`bank_01.asm:2709-2710`, `2744-2766`); von unten/seitlich nicht solide (`bank_01.asm:2619-2623`, `2656-2660`) | Disassembly |
| `$1FB`–`$1FF` | Lava: `JMP CODE_00F629` → `KillMario` (`bank_00.asm:12315-12318`, `13542-13543`) | (nicht untersucht) | Disassembly |

**`$1F0` konkret:** Vanilla gehört er zu den „Slope-Hilfstiles“ unter Schrägen. Isoliert platziert: Mario fällt/läuft durch, Sprites (Panzer usw.) können darauf stehen. Das entspricht dem Kaizo-Gebrauch „1F0 = nur für Sprites solide (von oben)“; im Projekt ist `371:1F0 base/Collectable.asm` so gemeint (`GPS/list.txt:139-140`, Beschreibung `Collectable.asm:25`). Seitlich oder von unten ist `$1F0` für Sprites **nicht** solide – wer „überall solide für Sprites“ will, setzt in SpriteV/H `$130` (`hurt_death.asm:70-74`). Die Interpretation beruht auf der Disassembly; **im Emulator nicht getestet**. Zusatz: das Archiv hat einen Block, der `$1F0` für Mario begehbar macht (`ARCH/block_42396_Mario_Interactable_1F0/Mario1F0.asm`), was indirekt bestätigt, dass Mario sonst durchfällt.

**Andere im Archiv gesehene Act-as-Werte** (Bedeutung aus Disassembly, soweit geprüft):
- `$01F`/`$020` Türen: `CPY #$20` Tür, `CPY #$1F` kleine Tür (nur wenn `$19 == 0`), `$027/$028` P-Switch-Türen (nur mit Blau-P-Timer) (`DISASM/bank_00.asm:12100-12120`). Archiv: `ARCH/block_3885_Warp_Block_Pack/doorcoinones.asm:15`.
- `$006` Ranke (kletterbar) – `$9C=$03` erzeugt „Vine (006)“ (`RAMDUMP` `$7E009C`); Archiv `ARCH/block_3948_Behind_Vine/BehindVine.asm:5-10`.
- `$137/$138`, `$13F` Röhreneingänge (Archiv: `ARCH/block_3954_Pipes_on_Small_Powerup/small_pipe_vleft.asm:13-15`, `ARCH/block_3889_Horizontal_Pipe_on_Levels_Beaten/pipe.asm:21`). **unverifiziert** gegen Disassembly.
- `$048` Dauer-Drehblock (`$9C=$05`, `RAMDUMP`), wird in `hurt_death.asm:75-78` als „für Sprites durchlässig, stoppt aber Ranken/Coin-Snakes“ benutzt.
- `$00B` Zaun/Netz (Kommentar `ARCH/block_39141_Fence__Net_Blocks_v1.3/blocks/behind_fence.asm:21-23`), `$02B` Münze, `$02C` (Archiv-Kommentare widersprüchlich: „blue coin“ bzw. „purple coin“, `ARCH/block_24290_Hurt_Yoshi/hurtyoshi.asm:43`, `ARCH/block_4081_Red_Coin/redcoin.asm:18`), `$11E` Drehblock, `$129` (Kommentar „Act like tile 129“ ohne Bedeutung, `ARCH/block_3926_Shop_Block_Using_Lives/Lives_Shop_Block.asm:46-48`) – Bedeutung **unverifiziert**.
- „`$1FF`“: liegt im Lava-Bereich `$1FB-$1FF` (s. o.) – tötet Mario.

### 2.3 Gotchas zu Act-as

- **`LDY #$10` statt `LDY #$01`** (ergibt `$1030` statt `$130`) kommt im Archiv 5× vor (`ARCH/block_3855_Anti-Fragile_Bridge_Block/Anti_Fragile.asm:31-33` mit Kommentar „Enter both as block # 130“, `ARCH/block_3836_ONOFF_Frozen_Lava/ice_lava.asm`, `ARCH/block_4053_…/EndLevel+1Star.asm`) **und lokal** in `GPS/blocks/base/OnDeathBlock.asm:26-28` (zusätzlich ohne `|!addr`). Da die Vanilla-Engine nur „High-Byte ≠ 0“ prüft, verhält sich das vermutlich wie `$130`; ob LM bei High-Byte ≥ 2 nachträglich nochmal auflöst, ist **unverifiziert**.
- Act-as-Änderungen gelten nur für den aktuellen Aufruf (Punkt + Frame). Wer sie für Mario *und* Sprites will, muss sie in allen betroffenen Offsets setzen (Muster: `mario_passable.asm:4-7` vs. `sprite_passable.asm:4-7`).
- Ohne Schreibzugriff gilt das Act-as aus `list.txt`/Lunar Magic (Abschnitt 8).

---

## 3. Routinen-Katalog (`GPS/routines/`, 34 Dateien)

### 3.1 Wie GPS Routinen findet und einbindet

- Jede `.asm` im Routinenordner (Standard `routines/`, per `-s <pfad>` änderbar, `README:27`) wird zu einer Routine; der **Dateiname ist der Name**, Aufruf `%name()` (`README:101-110`). Reserviert: Label, Define und Makro mit dem Dateinamen (`README:112-115`). Max. 100 Routinen (gps.exe-String „More than 100 routines located“).
- Generierter Code pro Routine (gps.exe-String): `!name = 0` und `macro name()` → `%include_once("routines/name.asm", name, $NN)` + `JSL name`. `include_once` legt die Routine **nur einmal pro ROM** ab (`freecode cleaned`) und merkt ihre Adresse in einer Tabelle bei `$0CB66F + NN*3`; weitere Blöcke nutzen den Zeiger. Konsequenz: **Routinen enden mit `RTL`** und laufen im Kontext des aufrufenden Blocks.
- Jeder Block wird als eigene Asar-Einheit gebaut: `incsrc "defines.asm"`, `incsrc "shared.asm"`, `freecode cleaned`, `_BLOCK_ENTRY_:`, `incsrc "<block>"`, `_BLOCK_EXIT_:` (gps.exe-String). Label-Kollisionen sind also nur innerhalb einer Blockdatei (+ eingebundener Routinen) relevant.
- Routinen dürfen seit GPS 1.4.0 **keine normalen Labels** verwenden, nur Makro-Labels `?label` bzw. `?+`/`?-` (`README:117-120`).
- Für ein Tool heißt das: Zusatz-Routinen sind einfach `.asm`-Dateien, die der Nutzer nach `tools/GPS/routines/` kopieren muss; Aufruf dann `%dateiname()`.

**Achtung, lokale Routinen verletzen die Label-Regel** (Kollisionsgefahr, wenn der Block gleichnamige Labels hat): `fireball_smoke.asm` (`.loop`, `.found`, `+`), `hundred_points.asm`, `row_points.asm`, `star_points.asm`, `stomped_points.asm` (`.loop`, `.next`, `.resume`, `+`, `++`), `face_yoshi.asm` (`-`, `+`, `++`…), `teleport_direct.asm` (`.FixedTeleport`, `+`).

### 3.2 Katalog

Register: „A/X/Y-Modus“ beim Aufruf 8-bit, sofern nicht anders angegeben. „Clobbert“ = verändert ohne Wiederherstellung (aus dem Code abgelesen).

| Routine | Zweck | Eingabe | Ausgabe / clobbert |
|---|---|---|---|
| `change_map16` | Setzt Map16-Tile an `$98/$9A` (inkl. VRAM-Update über `$00C0FB`) | `REP #$10 : LDX #tile` (16-bit X), danach `SEP #$10` (`change_map16.asm:4-8`) | Tauscht in vertikalen Levels `$99/$9B` → danach `%swap_XY()` (`:10-11`); nutzt `$06-$0F`, sichert `$0F`, P, X, Y (`:14-17`, `163-168`) |
| `check_sprite_kicked_horiz_alt` | „Trifft ein gekicktes Sprite?“ wie Vanilla: X-Speed ≠ 0 und Status `$0A`, oder Sprite ≥ `$0D` mit Status `$09` (Koopa-Sonderfall) | X = Sprite | Carry gesetzt = ja; A clobbert (`:12-30`) |
| `check_sprite_kicked_horizontal` | Status `$09`/`$0A` und |X-Speed| ≥ 8 | X = Sprite | Carry = ja; A (`:3-22`) |
| `check_sprite_kicked_vertical` | Sprite steigt (`!AA,x` < 0) und Status `$09`/`$0A` | X = Sprite | Carry = ja; A (`:5-15`) |
| `create_smoke` | Rauchwolke (`$17C0`-Typ 1, Timer `$1B`) an Blockposition | `$98/$9A` | sichert P, X (`:2-4`, `26-27`) |
| `erase_block` | Block → `$025` via `$9C=$02`, `JSL $00BEB0` | `$98/$9A` | sichert Y; A, X unbestimmt (`:2-7`) |
| `face_yoshi` | Dreht Yoshi gemäß `!Freeram_SSP_PipeDir` (Screen-Scrolling-Pipes) | – | braucht `!Freeram_SSP_PipeDir`, das **nicht** in `defines.asm` steht; Slotzahlen für SA-1/LoROM vertauscht (`:10-14`: `!sa1 == 0` → 22) – Bug |
| `fireball_smoke` | Löscht Feuerball, Rauch an seiner Position | X = Extended-Slot | sichert Y, P (`:3-4`, `30-31`) |
| `get_map16` | Liest Map16-Nummer an `$98/$9A` auf `$1933`-Layer | `$98-$9B`, `$1933` | A = Low (bzw. 16-bit), Y = High; `$FFFF` bei ungültiger Position (`:4-15`) |
| `give_points` | +1 auf 24-bit-Score von `$0F34` (= +10 Punkte, da Score/10) | – | X, A clobbert (`:2-16`); Score-Format: `CLI memory 7E0F34` |
| `glitter` | Glitzer (`$17C0`-Typ 5) an Blockposition, Layer-2-korrigiert | `$98/$9A` | sichert Y (`:6`, `40`) |
| `hundred_points` | Score-Sprite „100“ (`$16E1`=5) + Sound `$03` an `$1DF9` | `$98/$9A` | sichert X; A (`:2-35`) |
| `kill_sprite` | **tötet keine übergebenen Sprites**, sondern erzeugt ein „Quake“-Sprite Typ 1 (`$16CD`) an der Blockposition – wie ein von unten getroffener Block, der Sprites *auf* dem Block umwirft | `$98/$9A` | X clobbert (`:2-39`); `$16CD`: „1 = hitting/breaking a block“ (`CLI memory 7E16CD`) |
| `layer2_sprite_position` | Sprite-Position (Layer-2-korrigiert) nach `$00-$03` | X = Sprite, nur in SpriteV/H | sichert P (`:1-7`) |
| `move_spawn_above_block` | Sprite A auf Block −16 px | A = Slot | **X = Slot** (kein PHX!, `:2`) |
| `move_spawn_below_block` | Sprite A auf Block +16 px | A = Slot | sichert X |
| `move_spawn_into_block` | Sprite A auf Blockposition | A = Slot | sichert X |
| `move_spawn_relative` | Sprite A auf Block + (`$00`,`$01`) (vorzeichenbehaftet) | A = Slot, `$00/$01` | sichert X |
| `move_spawn_to_player` | Sprite A auf Mario (+16 Y) | A = Slot | sichert X |
| `move_spawn_to_sprite` | Sprite A auf Position von Sprite X | A = Ziel-Slot, X = Quelle | sichert Y |
| `rainbow_shatter_block` | Block löschen + bunte Scherben (`JSL $028663` mit A ≠ 0) | `$98/$9A` | sichert Y (`:1-32`) |
| `reset_turn_block` | Setzt Drehblock eines Bounce-Sprite-Slots zurück | Y = Bounce-Slot | (`:2-31`) |
| `row_points` | Score nach Sprite-Zähler `!1626,x` (200…1-Up) + Sound | X = Sprite | sichert Y |
| `set_item_memory` | Setzt Item-Memory-Bit für die Blockposition | `$98/$9A` | sichert P; nutzt `$04` (`:1-37`) |
| `shatter_block` | Block löschen + normale Scherben (`A=0` an `$028663`) | `$98/$9A` | sichert Y (`:1-33`); `ShatterBlock` = `$028663` (`DISASM/SMW_U.sym` Z. 11812) |
| `spawn_bounce_sprite` | Bounce-Sprite (wie ?-Block-Hüpfer) | A = Bounce-Nr., X = `$9C`-Wert, Y = Richtung, ggf. `$02-$04` | Y = Slot; clobbert A, X, `$05-$07` (`:2-6`) |
| `spawn_item_sprite` | Item aus Block via `JSL $02887D` | A → `$05` | (`:1-11`) |
| `spawn_sprite` | Normales/Custom-Sprite in freiem Slot | A = Nr., CLC = normal, SEC = custom (PIXI) | Carry clear = ok, **A = Slot, X = Slot** (X nicht gesichert); Status 1 (`:2-35`) |
| `spawn_sprite_block` | wie oben, verdrängt notfalls die obersten Slots, schreibt `$185E` | wie oben | sichert X (`:3`, `47`) |
| `sprite_block_position` | `$0A-$0D` → `$98-$9B`, `$185E` → `$1933` | nur SpriteV/H | (`:2-13`) |
| `star_points` | Score nach Stern-Kill-Zähler `$18D2` + Sound | – | sichert X |
| `stomped_points` | Score nach Stampf-Zähler `$1697` + Sound `$02` | – | sichert X |
| `swap_XY` | Tauscht `$99`/`$9B` in vertikalen Levels zurück | – | sichert P (`:1-16`) |
| `teleport` | Setzt Screen-Exit des aktuellen Screens auf Level A (16-bit) und startet Warp (`$71=$06`, `$88=0`) | `REP #$20 : LDA #level` | A/X/Y 8-bit nach Rückkehr (`:3-8`) |
| `teleport_direct` | Teleport ohne Animation (`$71=$0D`, `$0100=$0F`, `$141A++`) | X=0: Mario-Screen-Exit, X>0: Block-Screen-Exit, X<0: A (16-bit) = Exit | clobbert A, X (`:6-12`). Bug im Nicht-ExLevel-Zweig: `LDX $97 : LDX $99` statt `LDY $99` (`:75-76`) |

---

## 4. Häufige Aktionen (minimaler verifizierter Code)

| Aktion | Code | Quelle / Hinweise |
|---|---|---|
| Mario verletzen | `PHY : JSL $00F5B7|!bank : PLY` | `hurt_death.asm:89-92`. `$00F5B7` = `HurtMario` (`DISASM/SMW_U.sym` Z. 9350). Kehrt ohne Wirkung zurück bei `$71`≠0, I-Frames `$1497`, Stern `$1490`, Levelende (`DISASM/bank_00.asm:13484-13490`). **Clobbert Y** (`LDY #!SFX…`, `bank_00.asm:13504`, `13513`) – daher PHY/PLY. Small Mario → stirbt (`:13500-13501`) |
| Mario töten | `JSL $00F606|!bank` | `hurt_death.asm:96-97`; `KillMario` (`SMW_U.sym` Z. 9517; `bank_00.asm:13522-13541`, setzt `$71=$09`, Todesmusik) |
| Sprite entfernen (spurlos) | `STZ !14C8,x` | `sprite_killer.asm:33-34`; `ARCH/block_22898_Customizable_Sprite_Killer/spritekiller.asm:16-17` |
| Sprite töten mit Rauch/Sternen (Spin-Kill-Stil) | `LDA #$04 : STA !14C8,x : PHY : JSL $07FC3B|!bank : PLY` | `ARCH/block_22898_…/spritekiller.asm:19-23`. Status `$04` = „Killed with a spinjump“ (`RAMDUMP` `$7E14C8`). `$07FC3B` erzeugt Spinjump-Sterne am Sprite `$15E9` und clobbert Y (`DISASM/bank_07.asm:1304-1320`) |
| Sprite töten, fallend | `LDA #$02 : STA !14C8,x` | `$02` = „Killed and falling off screen“ (`RAMDUMP` `$7E14C8`) |
| Rauchwolke / Glitzer an Block | `%create_smoke()` / `%glitter()` | Routinen oben; `$17C0`-Typen: 1 Puff, 2 Kontakt, 3 Bremsrauch, 5 Glitzer (`RAMDUMP` `$7E17C0`) |
| Scherben | `%shatter_block()` / `%rainbow_shatter_block()` | löschen den Block mit |
| Block löschen | `%erase_block()` | `$9C`-Tabelle für andere Vanilla-Tiles: `RAMDUMP` `$7E009C` (z. B. `$0D` Used Block `$132`, `$06` Münze `$02B`) |
| Beliebiges Map16 setzen | `REP #$10 : LDX #$0400 : %change_map16() : SEP #$10` | `change_map16.asm:4-8`; in SpriteV/H vorher `%sprite_block_position()`; relativ zur eigenen Nummer: `LDX $03 : INX` (`DeathTransformBlock.asm:66-69`). Max. ~4 Tile-Änderungen pro Frame, sonst V-Blank-Überlauf (`ARCH/block_16917_…/readme.html`, Absatz „Be careful not to make it possible …“ – **unverifiziert** gegen Disassembly) |
| Soundeffekt | `LDA #$0B : STA $1DF9|!addr` | `set_to_on.asm:30`. Ports: `$1DF9` SFX, `$1DFA` Sonderkanal (Sprung, Yoshi-Trommel), `$1DFB` Musik, `$1DFC` SFX (`CLI memory 7E1DF9`; Symbole `SPCIO0-3` = `$1DF9-$1DFC`, `DISASM/SMW_U.sym` Z. 11700-11703). Vollständige Vanilla-ID-Listen: `RAMDUMP` Eintrag `$7E1DF9` (Modals für `$1DF9`, `$1DFA`, `$1DFB`, `$1DFC`) bzw. `DISASM/constants.asm:280-406`. Mit AddmusicK gilt `tools/AddmusicK/Addmusic_sound effects.txt` (Ordner `1DF9`/`1DFC`, `Docs/AddmusicK/readme_files/sound_effects.html`, Abschnitt „How to insert“) |
| Punkte | `%hundred_points()` (100 + Sound), `%give_points()` (+10 ohne Anzeige) | Score-Sprite-IDs `$16E1`: 1=10 … 5=100, 6=200 … `$0D` 1-Up (`RAMDUMP` `$7E16E1`) |
| Münzen | `LDA #n : JSL $05B329|!bank` (mit Münzsound) | `ARCH/block_4004_…/powerconditionalcoin.asm:16-18`; `DISASM/bank_05.asm` `ADDR_05B329` (spielt `SFX_COIN` an `$1DFC`, addiert auf CoinAdder) |
| Sprite spawnen | `LDA #$74 : CLC : %spawn_sprite() : BCS .fail : %move_spawn_into_block()` | `GPS/blocks/base/SpawnCarryableSprite.asm:16-21` (dort danach Status `$0B` = getragen). Custom (PIXI): `SEC` statt `CLC` (`spawn_sprite.asm:2`). `spawn_sprite` zerstört X → in Sprite-Offsets `PHX/PLX` (`sprite_killer.asm:28-30`) |
| Teleport | `%teleport_direct()` mit X=0 (Screen-Exit des Screens, auf dem Mario ist) | `GPS/blocks/global/teleport.asm:26-28`; alternativ `REP #$20 : LDA #level : %teleport()` |

---

## 5. Häufige Bedingungen

### 5.1 Mario / global (alle per `CLI memory` bzw. `RAMDUMP` geprüft)

| Bedingung | Adresse | Werte | SA-1 |
|---|---|---|---|
| ON/OFF | `$14AF` | `$00` = ON, sonst OFF | `|!addr` |
| Powerup | `$19` | 0 klein, 1 groß, 2 Cape, 3 Feuer (`RAMDUMP` `$7E0019`) | DP, ohne Suffix |
| Reitet Yoshi | `$187A` | 0 nein, 1 ja, 2 ja + dreht sich | `|!addr` |
| Stern | `$1490` | Timer ≠ 0 = aktiv | `|!addr` |
| Blauer P-Switch | `$14AD` | Timer ≠ 0 | `|!addr` |
| Silberner P-Switch | `$14AE` | Timer ≠ 0 | `|!addr` |
| Spin-Jump | `$140D` | ≠ 0 = Spin | `|!addr` |
| Trägt etwas | `$148F` (Pose) und `$1470` | ≠ 0 = trägt; beide prüfen (`CLI memory 7E1470`; Muster `SpawnCarryableSprite.asm:31-32`) | `|!addr` |
| X-Speed | `$7B` | signed, + rechts | DP |
| Y-Speed | `$7D` | signed, + abwärts (Muster „fällt/steht“: `LDA $7D : BPL`, `hurt_death.asm:40-41`) | DP |
| Blickrichtung | `$76` | 0 links, 1 rechts | DP |
| Duckt | `$73` | ≠ 0 = duckt | DP |
| In der Luft | `$72` | ≠ 0 = Luft (Wert = Pose) | DP |
| Klettert | `$74` | Bitfeld `n--shftb` | DP |
| Blockiert | `$77` | `S--M^v<>` | DP |
| I-Frames | `$1497` | ≠ 0 = blinkt | `|!addr` |
| Mario-Animation | `$71` | ≠ 0 = Sequenz aktiv (Tod `$09`, Warp `$06` …) | DP |
| Buttons | `$15`/`$16` (byetUDLR), `$17`/`$18` (axlr) | gehalten / neu gedrückt | DP |
| Layer | `$1933` | 0 = L1, 1 = L2/3 | `|!addr` |
| Sprites eingefroren | `$9D` | ≠ 0 | DP |

### 5.2 Sprites

- **Welches Sprite?** In SpriteV/H steht der Slot in X (= `$15E9`, `main.asm:127`; manche Blöcke laden explizit `LDX $15E9|!addr`, z. B. `ARCH/block_13458_Thwomp_Crush_Block/thwompcrush.asm:28`).
- **Vanilla-Nummer**: `!9E,x` (`defines.asm:65`).
- **Custom (PIXI)**: `LDA !7FAB10,x : AND #$08` (≠0 = custom), dann `LDA !7FAB9E,x` = Custom-Nummer (`thwompcrush.asm:29-35`; PIXI definiert `!CustomBit = $08`, `tools/PIXI/asm/sa1def.asm:10`, geprüft in `tools/PIXI/asm/main.asm:552-554`). Wichtig: bei Custom-Sprites ist `!9E,x` die Act-as-Nummer, deshalb erst das Custom-Bit prüfen. Extra-Bit: `!7FAB10,x & $04` (`sa1def.asm:20-23`). Achtung: `$7FAB10` ist ohne Custom-Sprite-Tool evtl. uninitialisiert (`GPS/routines/face_yoshi.asm:2-3`).
- **Status** `!14C8,x`: 0 leer, 1 Init, 2 tot/fällt, 3 zerquetscht, 4 Spin-Kill, 5 Lava, 6 Münze (Goal), 7 in Yoshis Maul, 8 normal, 9 stationär/tragbar (gestunnt), `$0A` gekickt, `$0B` getragen, `$0C` Goal-Powerup (`RAMDUMP` `$7E14C8`; Namen identisch in `DISASM/bank_01.asm`, z. B. Z. 226, 646, 1471, 5722).
- **Gekickt-Checks**: `%check_sprite_kicked_horizontal()`, `…_horiz_alt()`, `…_vertical()` (Abschnitt 3); Einsatz z. B. `question_block_base.asm:20-43`.
- **Speeds**: `!AA,x` (Y), `!B6,x` (X) (`defines.asm:66-67`); Richtung: `!157C,x` (`face_yoshi.asm:24`, 0 = rechts).
- **Getragenes Sprite ausnehmen**: Status `$0B` prüfen (`ARCH/block_22898_…/spritekiller.asm:11-15`). Vanilla ignoriert Top-Solid-Tiles bei Status 2, 5, `$0B` (`DISASM/bank_01.asm:2748-2756`).

### 5.3 SA-1-Regeln (aus `GPS/defines.asm` und README)

- `!sa1` wird über ROM-Header `$00FFD5 == $23` erkannt (`defines.asm:13-26`).
- `!addr` = `$6000` unter SA-1 → **alle absoluten Adressen `$0100-$1FFF`** mit `|!addr` (`$1693|!addr`, `$14AF|!addr`, `$1DF9|!addr`) (`defines.asm:7`, `22`; `README:153-160`).
- `!dp` = `$3000`: Direct-Page-Adressen (`$19`, `$7D`, `$98` …) bleiben ohne Suffix, da DP umgemappt ist (`defines.asm:6`, `21`). Direkter Absolutzugriff auf `$00xx` bräuchte `|!dp`.
- `!bank` = `$000000` (SA-1) bzw. `$800000` (FastROM) → `JSL $00F606|!bank` (`defines.asm:8`, `23`).
- **Sprite-Tabellen immer über Defines** (`!9E`, `!14C8`, `!sprite_status` …), da sie unter SA-1 verschoben sind, z. B. `$14C8` → `$3242`, `$9E` → `$3200` (`defines.asm:55-117`). Slotzahl: `!sprite_slots` `$0C` bzw. `$16` (`defines.asm:11`, `25`).
- WRAM-Freeram `$7Exxxx/$7Fxxxx` → unter SA-1 `$40xxxx/$41xxxx` (lokal: `DeathTransformBlock.asm:15-20`; `ARCH/block_16917_…/readme.html`: „blocks are run on SA-1 … use banks $40/$41“).
- Projekt: Callisto-Baserom mit `resources/initial_patches/fastrom.bps` **und** `sa1.bps` vorhanden; welches angewendet wird, habe ich nicht geprüft (**unverifiziert**).

---

## 6. Gotchas beim Zusammensetzen modularer Snippets

- **Registerbreiten**: Eintritt 8-bit A/X/Y (`main.asm:124`); Rückkehr mit 8-bit X/Y (1.4). Snippets, die `REP` benutzen, müssen vor Ende `SEP` machen. Viele Routinen erwarten 8-bit (Ausnahmen: `change_map16` 16-bit X, `teleport` 16-bit A).
- **Y ist Zustand** (Act-as High-Byte). Jedes Snippet, das Y benutzt oder eine Y-zerstörende Routine ruft (`HurtMario`, `$07FC3B`, `%spawn_bounce_sprite()`), braucht `PHY/PLY` – oder das Act-as-Snippet muss als letztes laufen.
- **X ist in Sprite-Offsets der Sprite-Slot**: Routinen, die X verändern (`%spawn_sprite()`, `%kill_sprite()`, `%give_points()`, `%move_spawn_above_block()`, `%teleport_direct()`), vorher `PHX`, nachher `PLX`.
- **Scratch-RAM**: Routinen benutzen `$00-$0F` (z. B. `change_map16` `$06-$0F`, `spawn_bounce_sprite` `$05-$07`, `set_item_memory` `$04`). In Sprite-Offsets enthalten `$0A-$0D` die Sprite-Kontaktposition (1.3) – vor dem Aufruf solcher Routinen sichern/auswerten.
- **Branch-Reichweite**: `BRA`/`Bxx` nur −128…+127 Byte, `BRL` ±32 KiB; Asar bricht bei Überschreitung ab. (65816-Standardwissen, **keine lokale Primärquelle** geprüft.) Da ein Block komplett in einer Bank liegt (gps.exe: „exceeds the size of a bank“), funktionieren `JMP label` (absolut) immer – so machen es auch die JMP-Tabellen. Übliches Muster für lange Sprünge: invertierte Bedingung + `JMP` (z. B. `hurt_death.asm:62-67` nutzt `JMP HurtOrKill`).
- **Label-Eindeutigkeit**: Pro Block eine Asar-Einheit (3.1) → Labels müssen nur innerhalb der Datei eindeutig sein; aber eingebundene Routinen landen im selben Namensraum (daher `?`-Labels, `README:117-120`). Asar-Sublabels `.x` hängen am letzten globalen Label. Die JMP-Tabellen-Labels sind globale Labels; mehrere Offsets dürfen auf dasselbe Label zeigen oder mehrere Labels übereinander stehen (Fall-through, `template.asm:7-23`, `Collectable.asm:9-18`).
- **Bedingungsketten im Archiv**: Standard ist „prüfen → bei Nichterfüllung zum gemeinsamen `Return` springen“ (Fall-through, z. B. `thwompcrush.asm:27-45`: Custom-Bit → Nummer → Status). If/else mit zwei Act-as-Zweigen und `BRA` über den else-Teil: `GPS/blocks/base/sprite_solid.asm:16-26` (Blockreator-Stil, `Label_0000`/`Label_0001`). ODER-Verknüpfung per `ORA` mehrerer Flags: `SpawnCarryableSprite.asm:31-35` (`LDA $1470 : ORA $148F : ORA $187A : ORA $74 : BNE Return`).
- **Mehrfachausführung** (1.5): Aktionen mit Nebenwirkung (Sound, Zähler, Spawn, Map16-Änderung) laufen potentiell mehrfach pro Frame/pro Punkt. Muster dagegen: Zustand prüfen (`set_to_on.asm:27-29`), Block sofort ersetzen (`Collectable.asm:17`) oder Cooldown-Timer (`ARCH/block_18347_…/readme.txt:15-18`).
- **Laufzeit**: Code läuft je Interaktionspunkt und Frame, unter SA-1 auf dem SA-1-Prozessor (`ARCH/block_16917_…/readme.html`). Konkrete Zyklenbudgets habe ich nicht gefunden (**unverifiziert**); das Archiv vermeidet Schleifen über alle Sprite-Slots im Block nicht grundsätzlich (`face_yoshi.asm:16-49`).
- **Absolute RAM-Zugriffe hängen an DB** (DB = Blockbank, 1.3). Das funktioniert, solange die Bank einen WRAM-Spiegel bei `$0000-$1FFF` hat (LoROM-Bänke `$00-$3F`/`$80-$BF`). **unverifiziert**, ob GPS-Freecode je in Bänken ohne Spiegel landen kann.
- **Beschreibung**: Die **erste** `print`-Anweisung wird zur Lunar-Magic-Tooltip-Beschreibung (.dsc); weitere `print "@hidden=…"`, `@pswitch=`, `@content=`, `@transparent` steuern die LM-Anzeige (`README:122-151`). Kommentare ignoriert Asar – dort können Metadaten stehen.

---

## 7. Prior Art

- **Blockreator** (Kipernal): SMWCentral-Tool „Blockreator“ in v1.1 (id 9397), v1.2 (id 15390), v1.3 (id 20129). Laut Suchergebnis-Beschreibung erstellt es GPS-Blöcke „by selecting certain conditions and events“ ohne ASM-Kenntnisse. Quellen: Web-Suche mit Treffern [Blockreator v1.1](https://www.smwcentral.net/?p=section&a=details&id=9397&r=0), [Blockreator v1.3](https://www.smwcentral.net/?p=section&a=details&id=20129), [Release-Thread](https://www.smwcentral.net/?p=viewthread&t=59178). Die Seiten selbst waren per WebFetch nicht lesbar (nur Copyright-Hinweis) – Details zu Speicherformat/Re-Import sind **unverifiziert**. Autor belegt durch `ARCH/block_16053_Repressable_button_switch_2.1/readme.txt:137-138` („Kipernal -> blockreator's spawn sprite routine“).
- **Erkennbare Blockreator-Ausgabe**: Labels `MarioCorner/MarioBody/MarioHead/Cape/Fireball`, Kommentarblöcke `; \ If … / ; /`, generische Sprungmarken `Label_0000:` und Trenner `; > --------`. Fundstellen: `ARCH/block_25114_Camera_Scrolling_Block/CameraScrollingBlock.asm:1-27`, `D:\dev\smwresources\downloads\graphics\graphics_29795_Organic_Land\Organic Land\Block\StarBlock.asm:1-35` und **lokal** `GPS/blocks/base/sprite_solid.asm:1-39`. Keine dieser Dateien enthält Metadaten für einen Re-Import (nur Code + Kommentare); `StarBlock.asm:19-27` zeigt sogar nachträglich vertauschte Kommentare (Kommentar „act like #$0025“ bei `LDA #$30/LDY #$01`) – ein Hinweis, dass Handedits den generierten Code von seinen Kommentaren entkoppeln.
- Archiv-Kritik an Blockreator-Hurt-Blöcken (Seitentreffer ohne Überlappung): `ARCH/block_41222_…/VanillaMuncher.asm:4-7`. Readme-Erwähnung als Alternative für Spawn-Blöcke: `ARCH/block_12329_Limited_spawner/readme.txt:9-10`.
- **GPS-GUI** (Alcaro) existierte früher, ist nicht mehr enthalten und kein Generator (`README:87-94`).
- Weitere Suche (`blocks/`, `discord/`, `flux/`, `uberasm/`) nach „block creator/generator/maker“ ergab keine weiteren Generatoren; `discord/810691154718883861_ProgrammableBlock` ist ein Sprite (`.cfg`), kein Block-Generator.

---

## 8. `list.txt` / Einfügen

- Format: `<blockid>[:<acts like>] <datei>`; Bereiche `200-202:10 datei` und Rechtecke `R203-214 datei`; ohne `:acts like` bleibt das bestehende Act-as unverändert; `;` = Kommentar (`README:37-57`). Projektliste identisch dokumentiert (`GPS/list.txt:1-12`).
- Pfade relativ zum Blockordner (`-b`, Standard `blocks/`, `README:26`), z. B. `0290:0130 global/mario_passable.asm` (`GPS/list.txt:26`).
- `@dsc` beendet das Parsen; danach nur noch .dsc-Zeilen (`README:59-76`, `GPS/list.txt:255`).
- Projektkonvention: neue Blöcke ab Map16-Seite 4 (`400+`) (`GPS/list.txt:17-19`; `D:\Games\Kaizo\Rage like Woot\AGENTS.md:161`, `238`). GPS nicht direkt starten, sondern über Callisto „Update“ (`…\Rage like Woot\AGENTS.md:216-218`).
- **Zusammenhang mit `$1693`**: GPS schreibt die Act-as-Werte in eine Tabelle (`__acts_likes_1.bin`/`_2.bin`) und hängt LMs Act-as-Zeiger bei `$06F624` (bzw. `$06F63A` für Seiten 40-7F) darauf um (`GPS/main.asm:36-37`, `46-57`). Das ist dieselbe Act-as-Einstellung, die LM verwendet („Allows setting of the Acts like setting from within the tool“, `README:5`). Beim Aufruf des Blockcodes steht dieser Wert in `$1693`/Y (1.3; Nachweis `SpawnCarryableSprite.asm:41-44` + `list.txt:78-83`). Schreibt der Blockcode `$1693`/Y um, überschreibt das den Listenwert nur für diesen Aufruf; schreibt er nichts, gilt der Listenwert. Deshalb kombinieren lokale Blöcke gezielt Listen-Act-as und Offsets: „insert with act as 130“ + nur Mario-Offsets → Luft für Mario, Zement für Sprites (`mario_passable.asm:1-16`).
- Leere Offsets: fehlt Code, gilt einfach das Listen-Act-as (z. B. `sprite_killer.asm` mit „act as 25“, `:1`).
- GPS erkennt doppelte Dateien und verwendet den Code wieder (`README:7`).

---

## Offene Punkte / unverifiziert

1. **WallFeet vs. WallBody**: Kommentare in `GPS/main.asm:62-72` widersprechen der Zuordnung in `main.asm:19`; welcher Wall-Run-Punkt welcher Offset ist, ungeklärt.
2. **Register bei MarioCape** (Inhalt von X, Bedeutung von `$98/$9A`) nicht aus Primärquelle belegt; nur indirekt aus `question_block_base.asm:49-51`.
3. **A beim Rücksprung** und genaue LM-Logik nach dem Block (`JMP $F602`) – LM-Code nicht disassembliert.
4. **`LDY #$10`-Varianten** (`$1030`): vermutlich wie `$130`, da Vanilla nur High ≠ 0 prüft; ob LM höhere Seiten erneut auflöst, ungeprüft.
5. **Alternierende Seitenpunkte bei Mario**: nur für Sprites in der Disassembly belegt; für Mario nur Archiv-Readme.
6. **`$1F0`-Verhalten** aus Disassembly abgeleitet, nicht im Emulator getestet.
7. Bedeutung von Act-as `$129`, `$02C`, `$137/$138/$13F` nicht gegen Disassembly geprüft.
8. **Blockreator**: Funktionsumfang, Speicherformat, Re-Import-Fähigkeit – Webseiten nicht lesbar.
9. **SA-1 im Projekt**: ob `sa1.bps` oder `fastrom.bps` aktiv ist, nicht geprüft.
10. **Zyklen-/Laufzeitbudget** für Blockcode: keine Quelle gefunden.
11. **Max. Map16-Änderungen pro Frame** (~4) nur aus Archiv-Readme.
12. **Freecode-Bank ohne WRAM-Spiegel** (Auswirkung von DB = Blockbank auf absolute RAM-Zugriffe) nicht geprüft.
13. Branch-Reichweiten sind 65816-Standard, nicht gegen eine lokale Asar-Doku zitiert.
