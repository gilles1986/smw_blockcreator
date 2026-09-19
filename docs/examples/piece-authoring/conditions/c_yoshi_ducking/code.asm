LDA $187A|!addr
BEQ {{false}}
LDA $73
{{#if ducking}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
