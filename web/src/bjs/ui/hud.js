// Brig — Babylon.js HUD (the UI win).
//
// A polished period interface built on @babylonjs/gui's fullscreen ADT, porting
// the look of the Three.js DOM HUD (web/index.html + web/src/main.js): parchment
// / gold / dark, Cormorant Garamond serif, rounded corners, soft shadows.
//
//   createHUD(scene, { handle }) -> {
//     setHint(text),
//     showPrompt(text) / hidePrompt(),
//     dialogue: { show(name, line), showChoices(name, choices), hide() },
//     setHelm({ heading, knots, sail, anchor, range }),
//     reticle: { show, hide },
//     openChronicleButton(onClick),
//   }
//
// Self-contained, importable. Writes only this file.

import * as GUI from '@babylonjs/gui';

// --- period palette (matched to the Three.js build) ---
const FONT = 'Cormorant Garamond, Georgia, serif';
const GOLD = '#e8b860';
const GOLD_SOFT = 'rgba(232, 184, 96, 0.4)';
const PARCH = '#f1e3c4';
const PARCH_DIM = 'rgba(244, 230, 200, 0.62)';
const INK_TOP = 'rgba(28, 18, 10, 0.94)';
const INK_BOT = 'rgba(16, 10, 5, 0.96)';
const PANEL_BORDER = 'rgba(200, 160, 90, 0.42)';
const SHADOW = 'rgba(0, 0, 0, 0.7)';

function applyShadow(ctrl, blur = 22, oy = 8) {
  ctrl.shadowColor = SHADOW;
  ctrl.shadowBlur = blur;
  ctrl.shadowOffsetX = 0;
  ctrl.shadowOffsetY = oy;
}

export function createHUD(scene, { handle } = {}) {
  const adt = GUI.AdvancedDynamicTexture.CreateFullscreenUI('brig-hud', true, scene);
  adt.renderScale = 1;
  // Reasonable design resolution so font sizes stay crisp on hi-dpi.
  adt.idealWidth = 1600;
  adt.useSmallestIdeal = false;
  adt.renderAtIdealSize = true;

  const me = handle || 'Wanderer';

  // =====================================================================
  // Title plate — top-left
  // =====================================================================
  const titlePlate = new GUI.Rectangle('titlePlate');
  titlePlate.width = '296px';
  titlePlate.height = '74px';
  titlePlate.thickness = 1;
  titlePlate.color = PANEL_BORDER;
  titlePlate.cornerRadius = 5;
  titlePlate.background = INK_TOP;
  titlePlate.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  titlePlate.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  titlePlate.left = '24px';
  titlePlate.top = '22px';
  titlePlate.paddingLeft = '18px';
  titlePlate.paddingRight = '14px';
  applyShadow(titlePlate, 28, 10);
  adt.addControl(titlePlate);

  const titleStack = new GUI.StackPanel('titleStack');
  titleStack.isVertical = true;
  titleStack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  titleStack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  titlePlate.addControl(titleStack);

  const titleMain = new GUI.TextBlock('titleMain');
  titleMain.text = 'BRIG';
  titleMain.color = PARCH;
  titleMain.fontFamily = FONT;
  titleMain.fontSize = 30;
  titleMain.fontWeight = '600';
  titleMain.height = '36px';
  titleMain.resizeToFit = false;
  titleMain.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  titleMain.shadowColor = SHADOW;
  titleMain.shadowBlur = 6;
  titleMain.shadowOffsetY = 2;
  // Letter spacing isn't a GUI prop; widen visually with thin spaces.
  titleMain.text = 'B R I G';
  titleStack.addControl(titleMain);

  const titleSub = new GUI.TextBlock('titleSub');
  titleSub.text = `· ${String(me).toUpperCase()} ·`;
  titleSub.color = GOLD;
  titleSub.fontFamily = FONT;
  titleSub.fontSize = 12;
  titleSub.fontStyle = 'italic';
  titleSub.height = '18px';
  titleSub.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  titleStack.addControl(titleSub);

  // =====================================================================
  // Chronicle button — top-right
  // =====================================================================
  const chronBtn = GUI.Button.CreateSimpleButton('chronBtn', 'The Chronicle');
  chronBtn.width = '178px';
  chronBtn.height = '46px';
  chronBtn.thickness = 1;
  chronBtn.color = GOLD_SOFT;
  chronBtn.cornerRadius = 5;
  chronBtn.background = INK_TOP;
  chronBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  chronBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  chronBtn.left = '-24px';
  chronBtn.top = '22px';
  chronBtn.isPointerBlocker = true;
  applyShadow(chronBtn, 24, 8);
  if (chronBtn.textBlock) {
    chronBtn.textBlock.text = 'The Chronicle';
    chronBtn.textBlock.color = GOLD;
    chronBtn.textBlock.fontFamily = FONT;
    chronBtn.textBlock.fontSize = 17;
    chronBtn.textBlock.fontStyle = 'italic';
  }
  chronBtn.onPointerEnterObservable.add(() => {
    chronBtn.background = 'rgba(46, 30, 16, 0.96)';
    chronBtn.color = GOLD;
  });
  chronBtn.onPointerOutObservable.add(() => {
    chronBtn.background = INK_TOP;
    chronBtn.color = GOLD_SOFT;
  });
  adt.addControl(chronBtn);

  // =====================================================================
  // Helm readout strip — top-center, hidden until setHelm is called
  // =====================================================================
  const helmStrip = new GUI.Rectangle('helmStrip');
  helmStrip.height = '40px';
  helmStrip.adaptWidthToChildren = true;
  helmStrip.thickness = 1;
  helmStrip.color = PANEL_BORDER;
  helmStrip.cornerRadius = 20;
  helmStrip.background = INK_TOP;
  helmStrip.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  helmStrip.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  helmStrip.top = '24px';
  helmStrip.paddingLeft = '20px';
  helmStrip.paddingRight = '20px';
  helmStrip.isVisible = false;
  applyShadow(helmStrip, 22, 8);
  adt.addControl(helmStrip);

  const helmRow = new GUI.StackPanel('helmRow');
  helmRow.isVertical = false;
  helmRow.height = '38px';
  helmStrip.addControl(helmRow);

  // Build one labelled readout cell: small gold label + parchment value.
  function helmCell(label) {
    const cell = new GUI.StackPanel();
    cell.isVertical = true;
    cell.adaptWidthToChildren = true;
    cell.paddingLeft = '12px';
    cell.paddingRight = '12px';
    cell.height = '38px';

    const lbl = new GUI.TextBlock();
    lbl.text = label;
    lbl.color = GOLD;
    lbl.fontFamily = FONT;
    lbl.fontSize = 9;
    lbl.height = '12px';
    lbl.resizeToFit = true;
    lbl.fontStyle = 'italic';
    cell.addControl(lbl);

    const val = new GUI.TextBlock();
    val.text = '—';
    val.color = PARCH;
    val.fontFamily = FONT;
    val.fontSize = 18;
    val.fontWeight = '600';
    val.height = '22px';
    val.resizeToFit = true;
    cell.addControl(val);

    return { cell, val };
  }

  function helmDivider() {
    const d = new GUI.Rectangle();
    d.width = '1px';
    d.height = '22px';
    d.background = GOLD_SOFT;
    d.thickness = 0;
    d.paddingTop = '8px';
    return d;
  }

  const cHeading = helmCell('HEADING');
  const cKnots = helmCell('SPEED');
  const cSail = helmCell('SAIL');
  const cAnchor = helmCell('ANCHOR');
  const cRange = helmCell('SANTO DOMINGO');

  helmRow.addControl(cHeading.cell);
  helmRow.addControl(helmDivider());
  helmRow.addControl(cKnots.cell);
  helmRow.addControl(helmDivider());
  helmRow.addControl(cSail.cell);
  helmRow.addControl(helmDivider());
  helmRow.addControl(cAnchor.cell);
  helmRow.addControl(helmDivider());
  helmRow.addControl(cRange.cell);

  // =====================================================================
  // Hint line — bottom-center, faint ambient guidance
  // =====================================================================
  const hint = new GUI.TextBlock('hint');
  hint.text = `welcome aboard, ${me}`;
  hint.color = PARCH_DIM;
  hint.fontFamily = FONT;
  hint.fontSize = 15;
  hint.fontStyle = 'italic';
  hint.height = '24px';
  hint.resizeToFit = false;
  hint.textWrapping = true;
  hint.width = '90%';
  hint.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  hint.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  hint.top = '-26px';
  hint.shadowColor = SHADOW;
  hint.shadowBlur = 8;
  hint.shadowOffsetY = 2;
  adt.addControl(hint);

  // =====================================================================
  // Interaction prompt pill — bottom-center, above the hint
  // =====================================================================
  const promptPill = new GUI.Rectangle('promptPill');
  promptPill.height = '50px';
  promptPill.adaptWidthToChildren = true;
  promptPill.thickness = 1;
  promptPill.color = GOLD_SOFT;
  promptPill.cornerRadius = 25;
  promptPill.background = INK_TOP;
  promptPill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  promptPill.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  promptPill.top = '-66px';
  promptPill.paddingLeft = '26px';
  promptPill.paddingRight = '26px';
  promptPill.isVisible = false;
  promptPill.alpha = 0;
  applyShadow(promptPill, 26, 10);
  adt.addControl(promptPill);

  const promptText = new GUI.TextBlock('promptText');
  promptText.text = '';
  promptText.color = PARCH;
  promptText.fontFamily = FONT;
  promptText.fontSize = 18;
  promptText.resizeToFit = true;
  promptText.height = '24px';
  promptPill.addControl(promptText);

  // =====================================================================
  // Reticle — centered small ring + dot
  // =====================================================================
  const reticleRing = new GUI.Ellipse('reticleRing');
  reticleRing.width = '22px';
  reticleRing.height = '22px';
  reticleRing.thickness = 1.5;
  reticleRing.color = 'rgba(241, 227, 196, 0.7)';
  reticleRing.background = 'transparent';
  reticleRing.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  reticleRing.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  reticleRing.isVisible = false;
  reticleRing.shadowColor = 'rgba(0,0,0,0.5)';
  reticleRing.shadowBlur = 4;
  adt.addControl(reticleRing);

  const reticleDot = new GUI.Ellipse('reticleDot');
  reticleDot.width = '3px';
  reticleDot.height = '3px';
  reticleDot.thickness = 0;
  reticleDot.background = GOLD;
  reticleDot.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  reticleDot.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  reticleDot.isVisible = false;
  adt.addControl(reticleDot);

  // =====================================================================
  // Dialogue panel — bottom-center framed plate
  // =====================================================================
  const dlgPanel = new GUI.Rectangle('dlgPanel');
  dlgPanel.width = '680px';
  dlgPanel.adaptHeightToChildren = true;
  dlgPanel.thickness = 1;
  dlgPanel.color = PANEL_BORDER;
  dlgPanel.cornerRadius = 5;
  dlgPanel.background = INK_BOT;
  dlgPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  dlgPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  dlgPanel.top = '-64px';
  dlgPanel.isVisible = false;
  dlgPanel.alpha = 0;
  applyShadow(dlgPanel, 40, 12);
  adt.addControl(dlgPanel);

  // Warm dark leather wash behind the dialogue text (top->bottom gradient).
  // LinearGradient takes canvas pixel coords; the panel height is dynamic, so a
  // generously tall vertical span keeps the wash reading top-to-bottom.
  const dlgFill = new GUI.Rectangle('dlgFill');
  dlgFill.thickness = 0;
  dlgFill.cornerRadius = 4;
  dlgFill.background = INK_BOT;
  const dlgGrad = new GUI.LinearGradient(0, 0, 0, 240);
  dlgGrad.addColorStop(0, INK_TOP);
  dlgGrad.addColorStop(1, INK_BOT);
  dlgFill.backgroundGradient = dlgGrad;
  dlgPanel.addControl(dlgFill);

  const dlgStack = new GUI.StackPanel('dlgStack');
  dlgStack.isVertical = true;
  dlgStack.paddingTop = '20px';
  dlgStack.paddingBottom = '16px';
  dlgStack.paddingLeft = '28px';
  dlgStack.paddingRight = '28px';
  dlgStack.width = '680px';
  dlgPanel.addControl(dlgStack);

  // A thin gold rule under the speaker name.
  const dlgRule = new GUI.Rectangle('dlgRule');
  dlgRule.height = '1px';
  dlgRule.width = '100%';
  dlgRule.thickness = 0;
  dlgRule.background = GOLD_SOFT;
  dlgRule.paddingTop = '8px';
  dlgRule.paddingBottom = '10px';

  const dlgSpeaker = new GUI.TextBlock('dlgSpeaker');
  dlgSpeaker.text = '';
  dlgSpeaker.color = GOLD;
  dlgSpeaker.fontFamily = FONT;
  dlgSpeaker.fontSize = 19;
  dlgSpeaker.fontWeight = '600';
  dlgSpeaker.height = '26px';
  dlgSpeaker.resizeToFit = false;
  dlgSpeaker.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  const dlgLine = new GUI.TextBlock('dlgLine');
  dlgLine.text = '';
  dlgLine.color = PARCH;
  dlgLine.fontFamily = FONT;
  dlgLine.fontSize = 17;
  dlgLine.fontStyle = 'italic';
  dlgLine.textWrapping = true;
  dlgLine.resizeToFit = true;
  dlgLine.lineSpacing = '6px';
  dlgLine.width = '624px';
  dlgLine.paddingTop = '10px';
  dlgLine.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // Continuation marker ("PRESS E") shown in single-line mode.
  const dlgCont = new GUI.TextBlock('dlgCont');
  dlgCont.text = 'PRESS  E';
  dlgCont.color = PARCH_DIM;
  dlgCont.fontFamily = FONT;
  dlgCont.fontSize = 11;
  dlgCont.height = '22px';
  dlgCont.paddingTop = '12px';
  dlgCont.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;

  // Choices stack (built on demand).
  const dlgChoices = new GUI.StackPanel('dlgChoices');
  dlgChoices.isVertical = true;
  dlgChoices.paddingTop = '12px';
  dlgChoices.width = '624px';
  dlgChoices.isVisible = false;

  function rebuildDialogueBody(mode) {
    dlgStack.clearControls();
    dlgStack.addControl(dlgSpeaker);
    dlgStack.addControl(dlgRule);
    dlgStack.addControl(dlgLine);
    if (mode === 'choices') {
      dlgStack.addControl(dlgChoices);
      dlgChoices.isVisible = true;
    } else {
      dlgStack.addControl(dlgCont);
    }
  }

  // =====================================================================
  // Animation helpers (fade in/out via alpha, no DOM transitions).
  // =====================================================================
  function fade(ctrl, to, ms = 220, onDone) {
    if (ctrl._fadeObs) {
      scene.onBeforeRenderObservable.remove(ctrl._fadeObs);
      ctrl._fadeObs = null;
    }
    if (to > 0) ctrl.isVisible = true;
    const from = ctrl.alpha;
    let t = 0;
    ctrl._fadeObs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime();
      const k = ms <= 0 ? 1 : Math.min(1, t / ms);
      // smoothstep
      const e = k * k * (3 - 2 * k);
      ctrl.alpha = from + (to - from) * e;
      if (k >= 1) {
        scene.onBeforeRenderObservable.remove(ctrl._fadeObs);
        ctrl._fadeObs = null;
        ctrl.alpha = to;
        if (to <= 0) ctrl.isVisible = false;
        if (onDone) onDone();
      }
    });
  }

  // =====================================================================
  // Public API
  // =====================================================================

  function setHint(text) {
    hint.text = text == null ? '' : String(text);
  }

  function showPrompt(text) {
    promptText.text = text == null ? '' : String(text);
    fade(promptPill, 1, 180);
  }
  function hidePrompt() {
    fade(promptPill, 0, 160);
  }

  const dialogue = {
    show(name, line) {
      dlgSpeaker.text = (name == null ? '' : String(name)).toUpperCase();
      dlgLine.text = line == null ? '' : String(line);
      rebuildDialogueBody('line');
      fade(dlgPanel, 1, 240);
    },
    showChoices(name, choices) {
      dlgSpeaker.text = (name == null ? '' : String(name)).toUpperCase();
      const list = Array.isArray(choices) ? choices : [];
      // A choice can be a plain string, or { text/label, onSelect/onClick }.
      const first = list[0];
      dlgLine.text =
        first && typeof first === 'object' && (first.prompt || first.line)
          ? String(first.prompt || first.line)
          : '';
      dlgChoices.clearControls();
      list.forEach((c, i) => {
        const label =
          typeof c === 'string' ? c : c.text || c.label || c.title || `Option ${i + 1}`;
        const cb =
          typeof c === 'object' ? c.onSelect || c.onClick || c.action : null;

        const btn = GUI.Button.CreateSimpleButton(`choice-${i}`, '');
        btn.height = '38px';
        btn.paddingTop = '4px';
        btn.paddingBottom = '4px';
        btn.thickness = 1;
        btn.color = GOLD_SOFT;
        btn.cornerRadius = 4;
        btn.background = 'rgba(40, 26, 14, 0.55)';
        btn.isPointerBlocker = true;
        btn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        btn.width = '624px';

        if (btn.textBlock) {
          btn.textBlock.text = `${i + 1}.  ${label}`;
          btn.textBlock.color = PARCH;
          btn.textBlock.fontFamily = FONT;
          btn.textBlock.fontSize = 16;
          btn.textBlock.fontStyle = 'italic';
          btn.textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
          btn.textBlock.paddingLeft = '16px';
        }
        btn.onPointerEnterObservable.add(() => {
          btn.background = 'rgba(60, 40, 20, 0.85)';
          btn.color = GOLD;
        });
        btn.onPointerOutObservable.add(() => {
          btn.background = 'rgba(40, 26, 14, 0.55)';
          btn.color = GOLD_SOFT;
        });
        btn.onPointerUpObservable.add(() => {
          if (typeof cb === 'function') cb(c, i);
        });
        dlgChoices.addControl(btn);
      });
      rebuildDialogueBody('choices');
      fade(dlgPanel, 1, 240);
    },
    hide() {
      fade(dlgPanel, 0, 200, () => {
        dlgChoices.clearControls();
        dlgChoices.isVisible = false;
      });
    },
  };

  function setHelm({ heading, knots, sail, anchor, range } = {}) {
    helmStrip.isVisible = true;

    if (heading != null && Number.isFinite(heading)) {
      const hdg = ((Math.round(heading) % 360) + 360) % 360;
      cHeading.val.text = `${hdg}°`;
    }
    if (knots != null && Number.isFinite(knots)) {
      cKnots.val.text = `${knots.toFixed ? knots.toFixed(1) : knots} kn`;
    }
    if (sail != null) {
      // sail may be a number (0..1 set fraction) or a label string.
      if (typeof sail === 'number') {
        cSail.val.text = `${Math.round(sail * 100)}%`;
      } else {
        cSail.val.text = String(sail);
      }
    }
    if (anchor != null) {
      // anchor true => stowed/up (under way); accepts bool or string.
      let up;
      if (typeof anchor === 'boolean') up = anchor;
      else up = String(anchor).toLowerCase().includes('up');
      cAnchor.val.text = up ? 'UP' : 'DOWN';
      cAnchor.val.color = up ? PARCH : GOLD;
    }
    if (range != null && Number.isFinite(range)) {
      cRange.val.text = range > 9000 ? '—' : `${Math.round(range)} m`;
    } else if (range != null) {
      cRange.val.text = String(range);
    }
  }

  const reticle = {
    show() {
      reticleRing.isVisible = true;
      reticleDot.isVisible = true;
    },
    hide() {
      reticleRing.isVisible = false;
      reticleDot.isVisible = false;
    },
  };

  function openChronicleButton(onClick) {
    chronBtn.onPointerUpObservable.clear();
    if (typeof onClick === 'function') {
      chronBtn.onPointerUpObservable.add(() => onClick());
    }
    return chronBtn;
  }

  return {
    adt, // exposed for teardown / advanced callers
    setHint,
    showPrompt,
    hidePrompt,
    dialogue,
    setHelm,
    reticle,
    openChronicleButton,
  };
}

export default createHUD;
