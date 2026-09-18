{{#if secret}}
LDA #$01 : STA $141C|!addr
{{else}}
STZ $141C|!addr
{{/if}}
LDA #$FF : STA $1493|!addr
