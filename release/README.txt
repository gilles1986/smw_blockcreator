BlockCreator @VERSION@
======================

A visual editor for Super Mario World custom blocks (GPS). Put a block together from
Pieces, Slot by Slot (the sides of the block), and get GPS assembly that works on
LoROM and on SA-1.


START

  Double-click BlockCreator.exe.
  You need Windows 10 or 11 with the WebView2 runtime (it is normally there).


USING IT WITH A ROM HACK

  1. Build the block: fill its Slots with Pieces.
  2. Choose "Save to project..." and pick your GPS folder (the one with asar.dll).
  3. Set the Map16 number and the act-as.
  4. Run GPS.


YOUR OWN PIECES

  A Piece is one building block of the editor: an Action (it does something) or a
  Condition (a yes/no test for "if"). The Pieces menu > Custom Pieces lets you create,
  edit, import and export your own.

  Where they are kept is your choice, in the same window ("Your Pieces are kept ..."):

    - In the app data folder (the default): %APPDATA%\com.saphros.blockcreator\pieces
    - Next to BlockCreator.exe: the "pieces" folder next to this file. The Pieces then
      travel with the program: copy the whole folder, or put it on a USB stick, and
      they come along. BlockCreator must be in a folder you may write to (your
      Documents, your Desktop), not in C:\Program Files.

  When you switch, BlockCreator offers to copy your Pieces to the new place. The old
  ones stay where they were.

  To share Pieces: "Export All (.zip)" makes a zip, and a friend uses "Import (.zip)".


WRITING PIECES WITH AN AI

  With an AI coding tool (Claude Code, Codex, Cursor, ...): open this folder in it.
  It reads AGENTS.md and knows where things are and what to do. Then tell it what the
  Piece should do, for example: "A Condition: Mario is small and holding a shell".

  With a chat AI (ChatGPT, Claude.ai, ...): give it these files and say what the Piece
  should do:
    AGENTS.md
    docs\piece-authoring-for-ai.md
    docs\piece-authoring.md
    core\library\piece.schema.json

  The AI writes two files for each Piece: piece.json and code.asm. Put them in
  pieces\actions\<name>\ (or pieces\conditions\<name>\) and restart BlockCreator. Or
  pack them into a zip (the paths inside must be actions\<name>\piece.json and
  actions\<name>\code.asm) and use "Import (.zip)": no restart needed.

  BlockCreator tells you when a Piece has a mistake. Give the message to the AI.

  An AI can get a RAM address wrong. Try every new Piece in an emulator before you
  use it in a hack.


WHAT IS IN THIS FOLDER

  BlockCreator.exe                  the program
  README.txt                        this file
  AGENTS.md                         instructions for an AI tool
  docs\                             guides for writing Pieces
  library\                          the built-in Pieces, as examples for an AI. The
                                    program has its own copy: changing them here does
                                    nothing.
  core\library\piece.schema.json    the format of a Piece's piece.json
  CONTEXT.md                        the words BlockCreator uses
  pieces\                           your Pieces, if you keep them next to the program
                                    (it is made when you save the first one)
