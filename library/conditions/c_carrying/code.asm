LDA $148F|!addr
ORA $1470|!addr
{{#if carrying}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
