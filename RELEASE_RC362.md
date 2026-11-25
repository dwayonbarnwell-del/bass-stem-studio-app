# RC362: compact phone controls and a clear header

All four Rehearsal view selectors start at the same left edge as the other controls and occupy about half their row. Focus rings stay inside the selector. Extra repeat actions wrap on narrow screens, with comfortable button sizes and no horizontal overflow. Both tall fretboards retain their available height.

Band choice labels sit beside their selectors in four compact rows. Instrumental patterns say No vocals and omit the inactive vocal fader. Recordings retain their separate Voice mute and fader; no audio processing or mix defaults change.

The Ear Training header has its own fixed area outside the scrolling controls. Opening a phone keyboard can reduce the controls' scrolling area without sliding them beneath the heading. Section changes and practice playback reset the correct scroll container.

Checked in the browser at 390px and 320px widths, with a 430px reduced viewport for focused timing/BPM fields. All four view selectors fit, the additional repeat toolbar wraps without overflow, and both fretboards retain their 537px playing height at the larger phone size. Checked the four inline Band rows, No vocals with a hidden fader, and enabled Voice mute/fader on Rockaway. The existing rehearsal controller, independent audio gains, separation fallback and deletion/mix checks pass, alongside syntax and whitespace checks. The reduced viewport simulates keyboard space; a physical Android keyboard was not available for this check.
