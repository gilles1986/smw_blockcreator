LDA $187A|!addr
BEQ {{label "done"}}
LDA $18E2|!addr
BEQ {{label "done"}}
DEC
TAX
LDA #{{color}}
STA !15F6,x
{{label "done"}}:
