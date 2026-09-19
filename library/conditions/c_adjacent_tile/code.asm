; Look at the neighbour: move the block position ($98 = Y, $9A = X) there, read the tile in A
; (16 bits), compare, and put the position back before the branch (the flags are kept).
REP #$20
LDA $98
STA $00
LDA $9A
STA $02
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
%get_map16()
CMP #{{hex tile 4}}
PHP
LDA $00
STA $98
LDA $02
STA $9A
PLP
SEP #$20
{{#if comparison "equal"}}
BNE {{false}}
{{/if}}
{{#if comparison "different"}}
BEQ {{false}}
{{/if}}
