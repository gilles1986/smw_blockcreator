{{#if locked}}
STZ $1411|!addr
{{else}}
LDA #$01 : STA $1411|!addr
{{/if}}
