{{#if if_short "keep"}}
LDA $0DBF|!addr
SEC
SBC #{{amount}}
BCC {{label "short"}}
STA $0DBF|!addr
{{label "short"}}:
{{else}}
LDA $0DBF|!addr
SEC
SBC #{{amount}}
BCS {{label "left"}}
LDA #$00
{{label "left"}}:
STA $0DBF|!addr
{{/if}}
