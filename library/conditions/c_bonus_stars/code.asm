LDX $0DB3|!addr
LDA $0F48|!addr,x
CMP #{{value}}
{{#if comparison "equal"}}
BNE {{false}}
{{/if}}
{{#if comparison "not_equal"}}
BEQ {{false}}
{{/if}}
{{#if comparison "less"}}
BCS {{false}}
{{/if}}
{{#if comparison "greater_equal"}}
BCC {{false}}
{{/if}}
