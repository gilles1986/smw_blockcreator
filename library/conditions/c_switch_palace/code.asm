{{#if palace "green"}}
LDA $1F27|!addr
{{/if}}
{{#if palace "yellow"}}
LDA $1F28|!addr
{{/if}}
{{#if palace "blue"}}
LDA $1F29|!addr
{{/if}}
{{#if palace "red"}}
LDA $1F2A|!addr
{{/if}}
{{#if palace "all"}}
LDA $1F27|!addr
AND $1F28|!addr
AND $1F29|!addr
AND $1F2A|!addr
{{/if}}
{{#if pressed}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
