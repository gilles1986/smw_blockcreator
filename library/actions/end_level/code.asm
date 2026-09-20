{{#if secret}}
LDA #$01 : STA $141C|!addr
{{else}}
STZ $141C|!addr
{{/if}}
{{#if event_offset}}
LDA $1DEA|!addr
CMP #$FF
BEQ {{label "none"}}
CLC
ADC #{{event_offset}}
STA $1DEA|!addr
{{label "none"}}:
{{/if}}
LDA #$FF : STA $1493|!addr
