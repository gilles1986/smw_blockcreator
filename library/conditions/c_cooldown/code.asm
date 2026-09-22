LDA $14
SEC
{{#if address "custom"}}
SBC {{ram custom_address}}
{{else}}
SBC {{ram address}}
{{/if}}
CMP #{{hex frames 2}}
BCC {{false}}
LDA $14
{{#if address "custom"}}
STA {{ram custom_address}}
{{else}}
STA {{ram address}}
{{/if}}
