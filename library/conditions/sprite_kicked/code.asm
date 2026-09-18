{{#if direction "horizontal"}}
%check_sprite_kicked_horizontal()
BCC {{false}}
{{/if}}
{{#if direction "vertical"}}
%check_sprite_kicked_vertical()
BCC {{false}}
{{/if}}
{{#if direction "any"}}
%check_sprite_kicked_horizontal()
BCS {{label "hit"}}
%check_sprite_kicked_vertical()
BCC {{false}}
{{label "hit"}}:
{{/if}}
