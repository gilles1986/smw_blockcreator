LDA $0DBE|!addr
CMP #$63
BCS {{label "maxed"}}
INC
STA $0DBE|!addr
{{label "maxed"}}:
