{{#if locked}}
{{#if axis "horizontal" "both"}}
STZ $1411|!addr
{{/if}}
{{#if axis "vertical" "both"}}
STZ $1412|!addr
{{/if}}
{{else}}
{{#if axis "horizontal"}}
LDA #$01 : STA $1411|!addr
{{/if}}
{{#if axis "vertical"}}
LDA #$01 : STA $1412|!addr
{{/if}}
{{#if axis "both"}}
LDA #$01 : STA $1411|!addr : STA $1412|!addr
{{/if}}
{{/if}}
