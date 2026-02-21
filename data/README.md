# Test Academic Papers

These synthetic academic paper excerpts are designed to test the Knowledge Gap Finder app's ability to detect contradictions, identify knowledge gaps, and generate research questions.

## Papers

| File | Topic Focus | Word Count |
|------|-------------|------------|
| `paper-transformers-nlp.txt` | Transformer architectures, NLP benchmarks, attention mechanisms | ~750 |
| `paper-rnn-sequences.txt` | RNNs for long sequences, memory efficiency, few-shot learning | ~700 |
| `paper-model-efficiency.txt` | Training efficiency, quantization, knowledge distillation, pruning | ~700 |
| `paper-interpretability.txt` | Model interpretability, attention analysis, probing, explainability | ~750 |

## Designed Contradictions

1. **Transformer vs. RNN performance on long sequences**
   - Paper 1 claims: "Transformer models outperform RNNs on **all** sequence tasks, including long-sequence benchmarks"
   - Paper 2 claims: "RNNs achieve **superior performance** on long-sequence tasks compared to transformers when sequences exceed 8,000 tokens"

2. **Attention mechanism reliability for interpretability**
   - Paper 1 claims: "Attention visualization confirms that transformers learn meaningful linguistic patterns" and attention is the "critical component driving transformer performance"
   - Paper 4 claims: "Attention weights correlate with true feature importance only 34% of the time" and are "unreliable explanations"

3. **Few-shot / low-resource performance**
   - Paper 1 claims: "With fewer than 1,000 training examples, LSTM-based models matched or exceeded transformer performance in 3 of 5 task categories" but this advantage "disappears entirely" with more data
   - Paper 2 claims: "In low-resource settings with fewer than 500 training examples, RNN architectures consistently outperform transformers" and pre-trained models introduce "overfitting risks"

4. **Attention head redundancy**
   - Paper 1 claims: "The first four heads in each layer contributing approximately 78% of the attention-derived performance gain"
   - Paper 3 claims: "30% of heads can be removed with less than 1% accuracy impact" (suggesting high redundancy)

## Designed Knowledge Gaps

### Density Gaps (Topics with Low Coverage)
- **Genomic sequence analysis**: Only mentioned in Paper 2
- **Carbon emissions / environmental cost**: Only briefly mentioned in Paper 3
- **Responsible AI / accountability**: Only discussed in Paper 4
- **Time-series forecasting**: Only mentioned in Paper 2

### Structural Gaps (Well-Studied Topics Never Connected)
- **Model interpretability + Training efficiency**: Papers 3 and 4 each study these topics independently but never examine how compression affects interpretability (both papers note this as future work)
- **Knowledge distillation + Attention mechanisms**: Paper 3 studies distillation, Paper 4 studies attention, but the effect of distillation on attention patterns is never explored
- **RNN architectures + Model interpretability**: Paper 2 focuses on RNNs, Paper 4 on interpretability of transformers, but RNN interpretability is never discussed

## Research Question Triggers

- Paper 1 acknowledges "mechanisms by which [transformers] encode linguistic knowledge remain poorly understood"
- Paper 2 suggests "hybrid architectures that combine the strengths of both paradigms" as future work
- Paper 3 notes "compression may affect which features models rely upon for predictions" (links efficiency → interpretability)
- Paper 4 asks "What is the relationship between model compression and the faithfulness of post-hoc explanations?"
- Multiple papers have conflicting results on attention mechanisms, inviting reconciliation research

## Shared Topic Keywords

High-density (appear in 3+ papers): `transformers`, `attention mechanisms`, `language models`, `BERT`, `NLP`

Medium-density (appear in 2 papers): `RNNs/recurrent neural networks`, `pre-training`, `fine-tuning`, `training data`, `model performance`

Low-density (appear in 1 paper): `genomic sequences`, `knowledge distillation`, `quantization`, `probing classifiers`, `mechanistic interpretability`
