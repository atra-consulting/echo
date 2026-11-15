// Tests of the guided workflow. Like the other specs they derive selections
// and expectations from the structure of the text modules, not their wording.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CertificateType, TextModules } from '../../src/app/reference-text';
import { StepBox, draft, personFields, start, stepBox, stepSummaries } from './steps';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { Selection } from './text-modules';

const TYPES: CertificateType[] = ['abschlusszeugnis', 'zwischenzeugnis'];

// Selections that complete a step according to its rule.
function complete(box: StepBox): Selection[] {
    switch (box.selection_rule) {
        case 'one_sentence':
            return [{ step: box.step, sentence: 0 }];
        case 'one_rating':
            return [{ step: box.step, rating: box.ratings![0].rating, sentence: 0 }];
        case 'one_subtopic':
            return [{ step: box.step, subtopic: box.subtopics![0].subtopic, sentence: 0 }];
        case 'each_subtopic':
            return box
                .subtopics!.filter((s) => !s.optional)
                .map((s) => ({ step: box.step, subtopic: s.subtopic, rating: s.ratings![0].rating, sentence: 0 }));
    }
}

function boxes(textModules: TextModules): StepBox[] {
    return stepSummaries(textModules).map((s) => stepBox(textModules, s.step)!);
}

for (const type of TYPES) {
    describe(`steps of the ${type}`, () => {
        const textModules = bundledTextModules.get(type);

        it('follow the order of the text modules, as the stepper of the web app', () => {
            assert.deepEqual(
                stepSummaries(textModules).map((s) => s.step),
                textModules.textblocks.map((t) => t.name),
            );
        });

        it('derive the selection rule from the structure', () => {
            const rules = Object.fromEntries(stepSummaries(textModules).map((s) => [s.step, s.selection_rule]));
            assert.equal(rules['intro'], 'one_sentence');
            assert.equal(rules['position'], 'one_sentence');
            assert.equal(rules['performance'], 'each_subtopic');
            assert.equal(rules['behavior_evaluation'], 'each_subtopic');
            assert.equal(rules['conclusion'], 'one_subtopic');
            assert.equal(rules['farewell'], 'one_rating');
            assert.equal(rules['future_wishes'], 'one_rating');
        });

        it('deliver one box at a time, linked to its neighbours', () => {
            const all = boxes(textModules);
            all.forEach((box, index) => {
                assert.equal(box.position, index + 1);
                assert.equal(box.of, all.length);
                assert.equal(box.previous_step, all[index - 1]?.step ?? null);
                assert.equal(box.next_step, all[index + 1]?.step ?? null);
                assert.equal([box.sentences, box.ratings, box.subtopics].filter((x) => x).length, 1, box.step);
            });
            assert.equal(stepBox(textModules, 'unknown'), undefined);
        });

        it('mark only subtopics without rating levels in rated steps as optional', () => {
            for (const box of boxes(textModules)) {
                for (const subtopic of box.subtopics ?? []) {
                    assert.equal(subtopic.optional, box.selection_rule === 'each_subtopic' && !subtopic.ratings);
                }
            }
        });

        it('start with the steps, the person fields and the first box', () => {
            const result = start(textModules);
            assert.equal(result.first_step?.step, result.steps[0].step);
            const names = result.person_fields.map((f) => f.name);
            assert.ok(names.includes('salutation') && names.includes('lastname'));
            const lastname = result.person_fields.find((f) => f.name === 'lastname')!;
            assert.ok(lastname.used_in_steps.length > 0);
        });

        it('report progress for partial selections and complete after every step', () => {
            const empty = draft(textModules, [], {});
            assert.equal(empty.text, '');
            assert.equal(empty.next_step, textModules.textblocks[0].name);
            assert.equal(empty.complete, false);

            const all = boxes(textModules);
            const selections: Selection[] = [];
            for (const [index, box] of all.entries()) {
                selections.push(...complete(box));
                const result = draft(textModules, selections, { lastname: 'Muster' });
                assert.equal(result.next_step, all[index + 1]?.step ?? null, box.step);
                assert.deepEqual(
                    result.open_steps,
                    all.slice(index + 1).map((b) => b.step),
                );
            }
            const result = draft(textModules, selections, { lastname: 'Muster' });
            assert.equal(result.complete, true);
            // The current wording per step is part of the assembled text, with the placeholders replaced.
            for (const status of result.steps) {
                assert.ok(status.selected && status.selected.length > 0, status.step);
                for (const selected of status.selected) {
                    assert.ok(result.text.includes(selected.text), status.step);
                    assert.ok(!selected.text.includes('{lastname}'), status.step);
                }
            }
            assert.ok(result.steps.every((s) => s.status === 'complete'));
            assert.equal(result.text.split('\n\n').length, all.length);
        });

        it('report a rated step with some subtopics as partial', () => {
            const box = boxes(textModules).find((b) => b.selection_rule === 'each_subtopic')!;
            const [first, ...rest] = complete(box);
            const status = draft(textModules, [first], {}).steps.find((s) => s.step === box.step)!;
            assert.equal(status.status, rest.length > 0 ? 'partial' : 'complete');
            assert.deepEqual(
                status.open_subtopics,
                rest.map((s) => s.subtopic),
            );
        });
    });
}

describe('person fields', () => {
    it('list only fields that occur in the text modules, plus the salutation', () => {
        const textModules: TextModules = {
            textblocks: [{ name: 'intro', type: 'topic', title: '1.', options: ['{firstname} {unknown_field}'] }],
        };
        assert.deepEqual(personFields(textModules), [
            { name: 'salutation', label: 'Anrede', used_in_steps: [] },
            { name: 'firstname', label: 'Vorname', used_in_steps: ['intro'] },
        ]);
    });
});
