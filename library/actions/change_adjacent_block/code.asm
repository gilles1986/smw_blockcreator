; Move the block position ($98 = Y, $9A = X) to the neighbour, change it, and put it back.
REP #$20
LDA $98
PHA
LDA $9A
PHA
{{#if direction "above"}}
LDA $98
SEC
SBC #{{hex distance 4}}
STA $98
{{/if}}
{{#if direction "below"}}
LDA $98
CLC
ADC #{{hex distance 4}}
STA $98
{{/if}}
{{#if direction "left"}}
LDA $9A
SEC
SBC #{{hex distance 4}}
STA $9A
{{/if}}
{{#if direction "right"}}
LDA $9A
CLC
ADC #{{hex distance 4}}
STA $9A
{{/if}}
REP #$10
LDX #{{hex tile 4}}
%change_map16()
SEP #$10
REP #$20
PLA
STA $9A
PLA
STA $98
SEP #$20
