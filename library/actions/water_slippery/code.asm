{{#if water}}
LDA #$01 : STA $85
{{else}}
STZ $85
{{/if}}
{{#if slippery}}
LDA #$80 : STA $86
{{else}}
STZ $86
{{/if}}
