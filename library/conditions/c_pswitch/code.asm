{{#if switch_type "blue"}}
LDA $14AD|!addr
BEQ {{false}}
{{/if}}
{{#if switch_type "silver"}}
LDA $14AE|!addr
BEQ {{false}}
{{/if}}
{{#if switch_type "any"}}
LDA $14AD|!addr
ORA $14AE|!addr
BEQ {{false}}
{{/if}}
