{{#if toggle}}
LDA $14AF|!addr
EOR #$01
STA $14AF|!addr
{{else}}
{{#if state}}
LDA #$01
STA $14AF|!addr
{{else}}
STZ $14AF|!addr
{{/if}}
{{/if}}
