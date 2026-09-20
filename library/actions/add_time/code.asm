; Digit by digit: the carry flag left by "CMP #$0A / SBC #$0A" is the carry into the next digit.
LDA $0F33|!addr
CLC
ADC #{{ones}}
CMP #$0A
BCC {{label "ones"}}
SBC #$0A
{{label "ones"}}:
STA $0F33|!addr
LDA $0F32|!addr
ADC #{{tens}}
CMP #$0A
BCC {{label "tens"}}
SBC #$0A
{{label "tens"}}:
STA $0F32|!addr
LDA $0F31|!addr
ADC #{{hundreds}}
CMP #$0A
BCC {{label "hundreds"}}
; Beyond 999: stay at 999.
LDA #$09
STA $0F32|!addr
STA $0F33|!addr
{{label "hundreds"}}:
STA $0F31|!addr
