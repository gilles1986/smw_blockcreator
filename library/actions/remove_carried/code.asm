{{#if mode "drop"}}
; Let go of X/Y and of left / right for a frame, so Mario drops it and does not kick it away.
LDA #$40
TRB $15
LDA #$03
TRB $15
{{else}}
LDX #!sprite_slots-1
{{label "loop"}}:
LDA !14C8,x
CMP #$0B
BNE {{label "next"}}
STZ !14C8,x
STZ $1470|!addr
STZ $148F|!addr
{{label "next"}}:
DEX
BPL {{label "loop"}}
{{/if}}
