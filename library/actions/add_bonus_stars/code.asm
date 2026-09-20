LDX $0DB3|!addr
LDA $0F48|!addr,x
CLC
ADC #{{amount}}
CMP #$64
BCC {{label "ok"}}
LDA #$63
{{label "ok"}}:
STA $0F48|!addr,x
