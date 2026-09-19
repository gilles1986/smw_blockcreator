; The game's own release of the reserve item ($028008), called with data bank 02 as it does.
PHB
LDA #$02
PHA
PLB
JSL $028008|!bank
PLB
