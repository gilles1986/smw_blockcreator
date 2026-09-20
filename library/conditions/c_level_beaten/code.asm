LDX #{{hex level 2}}
LDA $1EA2|!addr,x
{{#if flag "beaten"}}
AND #$80
{{else}}
AND #$40
{{/if}}
{{#if is_set}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
