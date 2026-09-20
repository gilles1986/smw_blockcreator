LDX #!sprite_slots-1
{{label "loop"}}:
LDA !14C8,x
CMP #$08
{{#if state "none"}}
BCS {{false}}
{{else}}
BCS {{label "found"}}
{{/if}}
DEX
BPL {{label "loop"}}
{{#if state "some"}}
; No slot was alive: X is $FF, so N is set.
BMI {{false}}
{{label "found"}}:
{{/if}}
