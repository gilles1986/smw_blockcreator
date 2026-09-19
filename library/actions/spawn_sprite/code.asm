{{#if custom}}
LDA #{{hex sprite_number 2}}
SEC
{{else}}
{{#if sprite_number "218"}}
LDA #$04
{{else}}
{{#if sprite_number "219"}}
LDA #$05
{{else}}
{{#if sprite_number "220"}}
LDA #$06
{{else}}
{{#if sprite_number "221"}}
LDA #$07
{{else}}
{{#if sprite_number "223"}}
LDA #$09
{{else}}
LDA #{{hex sprite_number 2}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
CLC
{{/if}}
%spawn_sprite()
BCS {{label "fail"}}
{{#if position "above"}}
%move_spawn_above_block()
{{/if}}
{{#if position "below"}}
%move_spawn_below_block()
{{/if}}
{{#if position "inside"}}
%move_spawn_into_block()
{{/if}}
{{#if position "left"}}
LDA #$F0
STA $00
STZ $01
TXA
%move_spawn_relative()
{{/if}}
{{#if position "right"}}
LDA #$10
STA $00
STZ $01
TXA
%move_spawn_relative()
{{/if}}
{{#if position "offset"}}
LDA #{{signed x_offset}}
STA $00
LDA #{{signed y_offset}}
STA $01
TXA
%move_spawn_relative()
{{/if}}
{{#if custom}}
{{else}}
LDA #{{hex state 2}} : STA !14C8,x
{{/if}}
LDA #{{signed x_speed}} : STA !B6,x
LDA #{{signed y_speed}} : STA !AA,x
LDA #$10 : STA !154C,x
{{#if custom}}
{{#if extra_bit}}
LDA !7FAB10,x
ORA #$04
STA !7FAB10,x
{{/if}}
LDA #{{hex extra_byte_1 2}} : STA !7FAB40,x
LDA #{{hex extra_byte_2 2}} : STA !7FAB4C,x
LDA #{{hex extra_byte_3 2}} : STA !7FAB58,x
LDA #{{hex extra_byte_4 2}} : STA !7FAB64,x
{{/if}}
{{#if facing "right"}}
STZ !157C,x
{{/if}}
{{#if facing "left"}}
LDA #$01 : STA !157C,x
{{/if}}
{{#if facing "like_mario"}}
; $76 is 0 for left and 1 for right, the sprite's direction the other way round.
LDA $76
EOR #$01
STA !157C,x
{{/if}}
{{#if facing "away"}}
; Right (0) when the sprite is at or right of Mario, else left (1).
LDA !E4,x
SEC
SBC $94
LDA !14E0,x
SBC $95
LDA #$00
BCS {{label "right"}}
INC
{{label "right"}}:
STA !157C,x
{{/if}}
{{label "fail"}}:
