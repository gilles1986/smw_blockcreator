LDA $18E4|!addr
CLC
ADC #{{amount}}
BCC {{label "ok"}}
LDA #$FF
{{label "ok"}}:
STA $18E4|!addr
