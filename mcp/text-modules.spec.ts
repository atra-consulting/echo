import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CatalogTopic, Selection, SelectionError, catalog, compose, loadTextModules } from './text-modules';

// The tests derive their selections from the catalog, so they also pass with
// the text modules of a fork, as long as the structure is the same.
const textModules = loadTextModules('abschlusszeugnis');

// The first sentence of every topic, subtopic and (first) rating level.
function firstSentences(topics: CatalogTopic[]): Selection[] {
    return topics.flatMap((topic): Selection[] => {
        if (topic.sentences) {
            return [{ topic: topic.topic, sentence: 0 }];
        }
        if (topic.ratings) {
            return [{ topic: topic.topic, rating: topic.ratings[0].rating, sentence: 0 }];
        }
        return (topic.subtopics ?? []).map((subtopic) => ({
            topic: topic.topic,
            subtopic: subtopic.subtopic,
            rating: subtopic.ratings?.[0].rating,
            sentence: 0,
        }));
    });
}

function problems(selections: Selection[]): string[] {
    try {
        compose(textModules, selections, {});
    } catch (e) {
        assert.ok(e instanceof SelectionError);
        return e.problems;
    }
    assert.fail('expected a SelectionError');
}

describe('catalog', () => {
    it('lists sentences directly only for intro and position', () => {
        for (const topic of catalog(textModules)) {
            const direct = topic.topic === 'intro' || topic.topic === 'position';
            assert.equal(topic.sentences !== undefined, direct, topic.topic);
        }
    });

    it('numbers the sentences from 0', () => {
        const intro = catalog(textModules, 'intro')[0];
        assert.deepEqual(
            intro.sentences?.map((s) => s.sentence),
            intro.sentences?.map((_, index) => index),
        );
    });

    it('returns nothing for an unknown topic', () => {
        assert.deepEqual(catalog(textModules, 'unknown'), []);
    });

    it('uses the female variant for the salutation "Frau"', () => {
        assert.notEqual(loadTextModules('abschlusszeugnis', 'Frau'), textModules);
        assert.equal(loadTextModules('abschlusszeugnis', 'Herr'), textModules);
    });
});

describe('compose', () => {
    it('assembles one paragraph per topic and reports missing placeholders', () => {
        const topics = catalog(textModules);
        const composition = compose(textModules, firstSentences(topics), { firstname: 'Anna', lastname: 'Muster' });

        assert.equal(composition.text.split('\n\n').length, topics.length);
        assert.ok(composition.text.includes('Muster'));
        assert.ok(!composition.missingPlaceholders.some((p) => p.name === 'firstname' || p.name === 'lastname'));
        for (const placeholder of composition.missingPlaceholders) {
            assert.ok(composition.text.includes(`[${placeholder.label}]`), placeholder.name);
        }
    });

    it('rejects unknown topics and subtopics', () => {
        assert.match(problems([{ topic: 'unknown', sentence: 0 }])[0], /Unbekanntes Thema/);
        const topic = catalog(textModules).find((t) => t.subtopics)!;
        assert.match(problems([{ topic: topic.topic, sentence: 0 }])[0], /verlangt ein Unterthema/);
        assert.match(problems([{ topic: 'intro', subtopic: 'x', sentence: 0 }])[0], /keine Unterthemen/);
    });

    it('requires a known rating level only where there are rating levels', () => {
        const topic = catalog(textModules).find((t) => t.subtopics?.some((s) => s.ratings))!;
        const subtopic = topic.subtopics!.find((s) => s.ratings)!;
        const selection = { topic: topic.topic, subtopic: subtopic.subtopic, sentence: 0 };
        assert.match(problems([selection])[0], /Bewertungsstufe/);
        assert.match(problems([{ ...selection, rating: 'unbekannt' }])[0], /Bewertungsstufe/);
        assert.match(problems([{ topic: 'intro', rating: 'sehr gut', sentence: 0 }])[0], /keine Bewertungsstufen/);
    });

    it('rejects unknown sentence numbers and a second sentence per subtopic', () => {
        assert.match(problems([{ topic: 'intro', sentence: 999 }])[0], /Satz 999 gibt es nicht/);
        const both = problems([
            { topic: 'intro', sentence: 0 },
            { topic: 'intro', sentence: 1 },
        ]);
        assert.match(both[0], /nur ein Satz/);
    });

    it('collects all problems', () => {
        assert.equal(
            problems([
                { topic: 'unknown', sentence: 0 },
                { topic: 'intro', sentence: 999 },
            ]).length,
            2,
        );
    });
});
