{{#if mode "screen"}}
; X = 0: the destination of the screen Mario is on, as in the vanilla exit table.
LDX #$00
%teleport_direct()
{{/if}}
{{#if mode "sublevel"}}
REP #$20
LDA #{{hex sublevel 4}}
{{#if instant}}
; X < 0: a fixed destination, the level number in A.
LDX #$FF
%teleport_direct()
{{else}}
%teleport()
{{/if}}
{{/if}}
