{{#if comparison "greater_equal"}}
LDA $0F31|!addr
CMP #{{hundreds}}
BCC {{false}}
BNE {{label "yes"}}
LDA $0F32|!addr
CMP #{{tens}}
BCC {{false}}
BNE {{label "yes"}}
LDA $0F33|!addr
CMP #{{ones}}
BCC {{false}}
{{label "yes"}}:
{{/if}}
{{#if comparison "less"}}
LDA $0F31|!addr
CMP #{{hundreds}}
BCC {{label "yes"}}
BNE {{false}}
LDA $0F32|!addr
CMP #{{tens}}
BCC {{label "yes"}}
BNE {{false}}
LDA $0F33|!addr
CMP #{{ones}}
BCS {{false}}
{{label "yes"}}:
{{/if}}
{{#if comparison "equal"}}
LDA $0F31|!addr
CMP #{{hundreds}}
BNE {{false}}
LDA $0F32|!addr
CMP #{{tens}}
BNE {{false}}
LDA $0F33|!addr
CMP #{{ones}}
BNE {{false}}
{{/if}}
