{{#if axis "horizontal"}}
; A speed of $80 or more moves left, so it is limited against the negative maximum.
LDA !B6,x
CMP #$80
BCS {{label "left"}}
CMP #{{hex max 2}}
BCC {{label "done"}}
LDA #{{hex max 2}}
STA !B6,x
BRA {{label "done"}}
{{label "left"}}:
CMP #-{{hex max 2}}
BPL {{label "done"}}
LDA #-{{hex max 2}}
STA !B6,x
{{label "done"}}:
{{else}}
LDA !AA,x
CMP #$80
BCS {{label "done"}}
CMP #{{hex max 2}}
BCC {{label "done"}}
LDA #{{hex max 2}}
STA !AA,x
{{label "done"}}:
{{/if}}
