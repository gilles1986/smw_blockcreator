{{#if physics "water"}}
LDA $85
{{else}}
LDA $86
{{/if}}
{{#if state}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
