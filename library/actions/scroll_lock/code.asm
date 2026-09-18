{{#if locked}}
LDA #$01 : STA $1411|!addr
{{else}}
STZ $1411|!addr
{{/if}}
