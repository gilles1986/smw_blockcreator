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
LDA #{{hex state 2}} : STA !14C8,x
LDA #{{signed x_speed}} : STA !B6,x
LDA #{{signed y_speed}} : STA !AA,x
LDA #$10 : STA !154C,x
{{label "fail"}}:
