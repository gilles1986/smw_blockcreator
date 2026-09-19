LDA $0DC2|!addr
{{#if item "any"}}
BEQ {{false}}
{{/if}}
{{#if item 1}}
CMP #$01
BNE {{false}}
{{/if}}
{{#if item 2}}
CMP #$02
BNE {{false}}
{{/if}}
{{#if item 3}}
CMP #$03
BNE {{false}}
{{/if}}
{{#if item 4}}
CMP #$04
BNE {{false}}
{{/if}}
