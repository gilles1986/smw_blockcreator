LDA $1F2E|!addr
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
