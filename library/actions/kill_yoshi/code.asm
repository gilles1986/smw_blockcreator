LDA $187A|!addr
BEQ {{label "done"}}
LDA $18E2|!addr
BEQ {{label "done"}}
DEC
TAX
; What Yoshi holds in his mouth goes with him.
LDA $18AC|!addr
BEQ {{label "empty"}}
STZ $18AC|!addr
PHY
LDY !160E,x
BMI {{label "nomouth"}}
LDA #$00
STA !14C8,y
{{label "nomouth"}}:
PLY
{{label "empty"}}:
; Mario gets off.
STZ $187A|!addr
LDA #$02
STA !1FE2,x
STZ !C2,x
LDA #$03
STA $1DFA|!addr
STZ $0DC1|!addr
; The puff of smoke, and the stars: the routine takes the slot from $15E9.
STX $15E9|!addr
if !sa1
TXA
CLC
ADC #$16
STA $CC
TXA
CLC
ADC #$2C
STA $EE
endif
{{#if sound}}
LDA #$08
STA $1DF9|!addr
{{/if}}
LDA #$04
STA !14C8,x
LDA #$1F
STA !1540,x
PHY
JSL $07FC3B|!bank
PLY
{{label "done"}}:
