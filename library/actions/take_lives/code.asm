LDA $0DBE|!addr
SEC
SBC #{{amount}}
BCC {{label "short"}}
STA $0DBE|!addr
{{#if if_short "game_over"}}
BRA {{label "done"}}
{{label "short"}}:
LDA #$FF
STA $0DBE|!addr
JSL $00F606|!bank
{{label "done"}}:
{{else}}
{{label "short"}}:
{{/if}}
