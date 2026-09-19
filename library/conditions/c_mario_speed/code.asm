{{#if direction "down"}}
LDA $7D
BMI {{false}}
{{#if speed}}
CMP #{{hex speed 2}}
BCC {{false}}
{{/if}}
{{/if}}
{{#if direction "up"}}
LDA $7D
BPL {{false}}
{{#if speed}}
EOR #$FF
INC
CMP #{{hex speed 2}}
BCC {{false}}
{{/if}}
{{/if}}
{{#if direction "left"}}
LDA $7B
BPL {{false}}
{{#if speed}}
EOR #$FF
INC
CMP #{{hex speed 2}}
BCC {{false}}
{{/if}}
{{/if}}
{{#if direction "right"}}
LDA $7B
BEQ {{false}}
BMI {{false}}
{{#if speed}}
CMP #{{hex speed 2}}
BCC {{false}}
{{/if}}
{{/if}}
