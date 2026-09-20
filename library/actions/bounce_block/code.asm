; A = bounce sprite type ($1699), X = the block it turns into ($9C), Y = direction.
LDA #{{bounce}}
LDX #{{becomes}}
LDY #{{direction}}
%spawn_bounce_sprite()
